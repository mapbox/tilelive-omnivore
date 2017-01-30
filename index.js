var url = require('url');
var path = require('path');
var fs = require('fs');
var Bridge = require('tilelive-bridge');
var getMetadata = require('@mapbox/mapnik-omnivore').digest;
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
        if (err) return callback(err);
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

  if (layerName && metadata[0].layers.length === 1 && metadata.length === 1) override = true;

  var finalMetadata = {
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
    finalMetadata.json = { vector_layers: [] }; 
  }

  // Iterate through all layers and combine into a single tileset
  finalMetadata = metadata.reduce(function(final, current) {
    final.filesize += current.filesize;
    final.extent[0] = Math.min(final.extent[0], current.extent[0]);
    final.extent[1] = Math.min(final.extent[1], current.extent[1]);
    final.extent[2] = Math.max(final.extent[2], current.extent[2]);
    final.extent[3] = Math.max(final.extent[3], current.extent[3]);
    
    current.layers.forEach(function(layer) {
      var finalLayer = layer;

      if (typeof layer === 'string') {
        finalLayer = {
          type: current.dstype,
          layer: layer,
          file: current.filepath,
          name: override ? layerName : layer
        };
      } else finalLayer.name = layer.layer;

      final.layers.push(finalLayer);
    });

    if (final.json) current.json.vector_layers.forEach(function(layer) {
      if (override && final.format === 'pbf') layer.id = layerName;
      final.json.vector_layers.push(layer);
    });

    return final;

  }, finalMetadata);

  finalMetadata.center[0] = (finalMetadata.extent[0] + finalMetadata.extent[2]) / 2;
  finalMetadata.center[1] = (finalMetadata.extent[1] + finalMetadata.extent[3]) / 2;

  return _.template(xml)(finalMetadata);
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
