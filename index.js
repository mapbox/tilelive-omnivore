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
  metadata = _.clone(metadata);

  if (Array.isArray(metadata)) {
    if (metadata.length > 1) {
      if (!metadata.every(function(md) { return md.filetype === '.geojson'; })) {
        throw new Error('Multiple files allowed for GeoJSON only.');
      }
    }
  } else metadata = [metadata];

  if (metadata.length === 1) override = metadata[0].layers.length === 1 && layerName;

  //javascript: clone from an array doesn't work!!!
  //var final_metadata = _.clone(metadata[0]);
  var final_metadata = JSON.parse(JSON.stringify(metadata[0]));
  delete final_metadata.filepath;
  delete final_metadata.filename;
  final_metadata.format = final_metadata.dstype === 'gdal' ? 'webp' : 'pbf';
  final_metadata.layers = [];
  final_metadata.filesize = 0;
  if (final_metadata.json && final_metadata.json.vector_layers) { final_metadata.json.vector_layers = []; }
  metadata.forEach(function(md) {
    final_metadata.filesize += md.filesize;
    final_metadata.extent[0] = Math.min(final_metadata.extent[0], md.extent[0]);
    final_metadata.extent[1] = Math.min(final_metadata.extent[1], md.extent[1]);
    final_metadata.extent[2] = Math.min(final_metadata.extent[2], md.extent[2]);
    final_metadata.extent[3] = Math.min(final_metadata.extent[3], md.extent[3]);
    Array.prototype.push.apply(
      final_metadata.layers,
      md.layers.map(function(layer) {
        var final_layer = {
          layer: layer === Object(layer) ? layer.layer : layer,
          type: md.dstype,
          file: layer === Object(layer) ? layer.file : md.filepath
        };

        if (override) final_layer.name = layerName;
        else if (layer === Object(layer)) final_layer.name = layer.layer;
        else final_layer.name = layer;

        return final_layer;
      })
    );

    if (final_metadata.json && final_metadata.json.vector_layers) {
      Array.prototype.push.apply(
        final_metadata.json.vector_layers,
        md.json.vector_layers
      );

      if (override && final_metadata.format === 'pbf') {
        final_metadata.json.vector_layers = final_metadata.json.vector_layers.map(function(layer) {
          layer.id = layerName;
          return layer;
        });  
      }
    }
  });

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
