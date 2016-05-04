var path = require('path');
var datapath = path.dirname(require.resolve('mapnik-test-data'));

module.exports = ['csv', 'geojson', 'multi-geojson', 'gpx', 'kml', 'shp', 'tif']
  .reduce(function(memo, type) {
    var file = (function() {
      if (type === 'csv') return 'data/csv/bbl_current_csv.csv';
      if (type === 'geojson') return 'data/geojson/DC_polygon.geo.json';
      if (type === 'multi-geojson') return ['data/geojson/DC_polygon.geo.json', 'data/geojson/places.geo.json'];
      if (type === 'gpx') return 'data/gpx/fells_loop.gpx';
      if (type === 'kml') return 'data/kml/1week_earthquake.kml';
      if (type === 'shp') return 'data/shp/world_merc/world_merc.shp';
      if (type === 'tif') return 'data/geotiff/sample.tif';
    })();
    memo[type] = Array.isArray(file)
      ? (file.map(function(f) { return path.join(datapath, f); })).join(',')
      : path.join(datapath, file);
    return memo;
  }, {});
