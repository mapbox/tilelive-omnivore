var url = require('url');
var path = require('path');
var fs = require('fs');
var Bridge = require('tilelive-bridge');
var getMetadata = require('mapnik-omnivore').digest;
var _ = require('underscore');
var queue = require('queue-async');

var xml = fs.readFileSync(path.join(__dirname, 'template.xml'), 'utf8');

module.exports = Omnivore;

function Omnivore(uri, callback) {
  uri = url.parse(uri, true);
  var files = uri.pathname.split(',');
  var layerName = uri.query.layerName ? decodeURI(uri.query.layerName) : null;
  var omnivore = this;

  var q = queue();
  files.forEach(function(file) {
    var filepath = path.resolve(file);
    q.defer(function(next) {
      getMetadata(filepath, function(err, metadata) {
        if (err) next(err);
        // Stopgap while only 8 bit TIFFs are supported
        if (metadata.dstype === 'gdal' && metadata.raster.bands[0].rasterDatatype !== 'Byte') {
          return next('Only 8 bit TIFFs are supported');
        }
        metadata.filepath = filepath;
        next(null, metadata);
      });
    });
  });

  q.awaitAll(function(err, metadata) {
    if (err) { return callback(err); }
    try {
      var mapnikXml = Omnivore.getXml(metadata, layerName);
    }
    catch (err) {
      return callback(err);
    }
    new Bridge({ xml: mapnikXml }, setBridge);
  });


  function setBridge(err, source) {
    if (err) {
      return callback(err);
    }
    omnivore.bridge = source;
    callback(null, omnivore);
  }
}

Omnivore.registerProtocols = function(tilelive) {
  tilelive.protocols['omnivore:'] = Omnivore;
};

Omnivore.getXml = function(metadata, layerName) {
  var override;

  if (Array.isArray(metadata)) {
    if (metadata.length > 1) {
      if (!metadata.every(function(md) { return md.filetype === '.geojson'; })) {
        throw new Error('Multiple files allowed for GeoJSON only.');
      }
    }
  } else metadata = [metadata];

  if (metadata.length === 1) override = metadata[0].layers.length === 1 && layerName;

  var final_metadata = {
    format: metadata[0].dstype === 'gdal' ? 'webp' : 'pbf',
    layers: [],
    filesize: 0,
    center: metadata[0].center,
    extent: metadata[0].extent,
    projection: metadata[0].projection,
    minzoom: metadata[0].minzoom,
    maxzoom: metadata[0].maxzoom
  };

  // What happens to filename for bundles?

  if (metadata[0].json && metadata[0].json.vector_layers) { 
    final_metadata.json = { vector_layers: [] }; 
  }

  // Iterate through all layers and combine into a single tileset
  final_metadata = metadata.reduce(function(final, current) {
    final.filesize += current.filesize;
    final.extent[0] = Math.min(final.extent[0], current.extent[0]);
    final.extent[1] = Math.min(final.extent[1], current.extent[1]);
    final.extent[2] = Math.min(final.extent[2], current.extent[2]);
    final.extent[3] = Math.min(final.extent[3], current.extent[3]);
    
    current.layers = current.layers.map(function(layer) {
      // Set layer object
      layer = {
        type: current.dstype,
        layer: layer === Object(layer) ? layer.layer : layer,
        file: layer === Object(layer) ? layer.file : current.filepath
      };

      // Set layername
      if (override) layer.name = layerName;
      else if (layer === Object(layer)) layer.name = layer.layer;
      else layer.name = layer;
      
      return layer;
    });

    // Copy over layers
    final.layers = final.layers.concat(current.layers);

    // Copy over vector_layers
    if (final.json) {
      current.json.vector_layers = current.json.vector_layers.map(function(layer){
        if (override && final_metadata.format === 'pbf') {
          layer.id = layerName;
          return layer;
        } else return layer;
      });

      final.json.vector_layers = final.json.vector_layers.concat(current.json.vector_layers); 
    }

    return final;

  }, final_metadata);

  final_metadata.center[0] = (final_metadata.extent[0] + final_metadata.extent[2]) / 2;
  final_metadata.center[1] = (final_metadata.extent[1] + final_metadata.extent[3]) / 2;

  return _.template(xml)(final_metadata);
};

Omnivore.prototype.getInfo = function(callback) {
  this.bridge.getInfo(callback);
};

Omnivore.prototype.getTile = function(z, x, y, callback) {
  this.bridge.getTile(z, x, y, callback);
};

Omnivore.prototype.close = function(callback) {
  this.bridge.close(callback);
};
