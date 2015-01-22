var url = require('url');
var path = require('path');
var fs = require('fs');
var Bridge = require('tilelive-bridge');
var getMetadata = require('mapnik-omnivore').digest;
var _ = require('underscore');

var xml = fs.readFileSync(path.join(__dirname, 'template.xml'), 'utf8');

module.exports = Omnivore;

function Omnivore(uri, callback) {
  uri = url.parse(uri);
  var filepath = path.resolve(uri.pathname);
  var omnivore = this;

  getMetadata(filepath, getXml);

  function getXml(err, metadata) {
    if (err) return callback(err);
    
    // Stopgap while only 8 bit TIFFs are supported
    if (metadata.dstype === 'gdal' && metadata.raster.bands[0].rasterDatatype !== 'Byte') return callback('16 bit TIFFs are not supported');
    
    metadata.filepath = filepath;
    var mapnikXml = Omnivore.getXml(metadata);
    new Bridge({ xml: mapnikXml }, setBridge);
  }

  function setBridge(err, source) {
    if (err) return callback(err);
    omnivore.bridge = source;
    callback(null, omnivore);
  }
}

Omnivore.registerProtocols = function(tilelive) {
    tilelive.protocols['omnivore:'] = Omnivore;
};

Omnivore.getXml = function(metadata) {
  metadata = _.clone(metadata);
  metadata.format = metadata.dstype === 'gdal' ? 'webp' : 'pbf';
  metadata.layers = metadata.layers.map(function(name) {
    return {
      layer: name,
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
