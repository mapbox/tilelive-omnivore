var url = require('url');
var path = require('path');
var fs = require('fs');
var Bridge = require('tilelive-bridge');
var getMetadata = require('mapnik-omnivore').digest;
var _ = require('underscore');

var xml = fs.readFileSync(path.join(__dirname, 'template.xml'), 'utf8');

module.exports = Omnivore;

function Omnivore(uri, callback) {
  uri = url.parse(uri, true);
  var filepath = path.resolve(decodeURI(uri.pathname));
  var layerName = uri.query.layerName ? decodeURI(uri.query.layerName) : null;
  var omnivore = this;

  getMetadata(filepath, getXml);

  function getXml(err, metadata) {
    if (err) {
      return callback(err);
    }

    // Stopgap while only 8 bit TIFFs are supported
    if (metadata.dstype === 'gdal' && metadata.raster.bands[0].rasterDatatype !== 'Byte') {
      return callback('Only 8 bit TIFFs are supported');
    }

    metadata.filepath = filepath;
    var mapnikXml = Omnivore.getXml(metadata, layerName);
    new Bridge({ xml: mapnikXml }, setBridge);
  }

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
  var override = metadata.layers.length === 1 && layerName;

  metadata = _.clone(metadata);
  metadata.format = metadata.dstype === 'gdal' ? 'webp' : 'pbf';

  if (override && metadata.format === 'pbf') {
    metadata.json.vector_layers = metadata.json.vector_layers.map(function(layer) {
      layer.id = layerName;
      return layer;
    });  
  }

  metadata.layers = metadata.layers.map(function(layer) {
    return {
      name: override ? layerName : layer,
      layer: layer,
      type: metadata.dstype,
      file: metadata.filepath
    };
  });

  return _.template(xml)(metadata);
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
