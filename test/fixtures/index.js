var path = require('path');
var _ = require('underscore');

module.exports = ['csv', 'geojson', 'multi-geojson', 'gpx', 'kml', 'shp', 'tif']
  .reduce(function(memo, type) {
    var filepath = path.resolve(__dirname, type + '.metadata.json');
    memo[type] = _(require(filepath)).extend({ filepath: filepath });
    return memo;
  }, {});
