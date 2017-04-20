var test = require('tape').test;
var assert = require('assert');
var fs = require('fs');
var path = require('path');
var fixtures = require('./fixtures');
var expected = require('./expected');
var datasets = require('./datasets');
var Omnivore = require('..');
var queue = require('queue-async');
var tilelive = require('@mapbox/tilelive');
var OmnivoreBin = path.resolve(__dirname, '..', 'bin', 'mapnik-omnivore');
var spawn = require('child_process').spawn;
var VectorTile = require('vector-tile').VectorTile;
var Protobuf = require('pbf');
var zlib = require('zlib');

test('should set protocol as we would like', function(assert) {
  var fake_tilelive = {
    protocols: {}
  };
  Omnivore.registerProtocols(fake_tilelive);
  assert.equal(fake_tilelive.protocols['omnivore:'], Omnivore);
  assert.end();
});

test('metadata => xml', function(t) {
  var xml;
  for (var type in fixtures) {
    xml = Omnivore.getXml(fixtures[type]);
    xml = xml.replace(
      /<Parameter name="file">(.+?)<\/Parameter>/g,
      '<Parameter name="file">[FILEPATH]</Parameter>'
    );

    if (process.env.UPDATE) {
      try { assert.equal(xml, expected[type]); }
      catch (err) { newExpectations(type, xml); }
    } else {
      t.equal(xml, expected[type], 'correct xml for ' + type);
    }
  }
  t.end();
});

test('[names] layerName override for single-layered data types', function(t) {
  ['csv', 'geojson', 'shp', 'tif'].forEach(function(type) {
    var xml = Omnivore.getXml(fixtures[type], 'named').replace(
      /<Parameter name="file">(.+?)<\/Parameter>/g,
      '<Parameter name="file">[FILEPATH]</Parameter>'
    );

    t.equal(xml, expected[type + '.named'].replace(/Layer name="(.*?)"/g, 'Layer name="named"'), 'correctly named xml for ' + type);
  });
  t.end();
});

test('[names] layerName override ignored for multi-layered data types', function(t) {
  ['gpx', 'kml'].forEach(function(type) {
    var xml = Omnivore.getXml(fixtures[type], 'named').replace(
      /<Parameter name="file">(.+?)<\/Parameter>/g,
      '<Parameter name="file">[FILEPATH]</Parameter>'
    );

    t.equal(xml, expected[type], 'did not override names for ' + type);
  });
  t.end();
});

function newExpectations(type, xml) {
  console.log('updated expected xml for ' + type);
  fs.writeFileSync(path.resolve(__dirname, 'expected', type + '.mapnik.xml'), xml);
}

test('multiple inputs (metadata)', function(t) {
  t.doesNotThrow(
    function() { Omnivore.getXml(fixtures['multi-geojson']); },
    'does not throw on multiple GeoJSONs'
  );
  t.throws(
    function() { Omnivore.getXml([fixtures['geojson'], fixtures['tif']]); },
    'throws on different types'
  );
  t.throws(
    function() { Omnivore.getXml([fixtures['csv'], fixtures['kml']]); },
    'throws on different types, not being GeoJSON'
  );
  t.end();
});

test('multiple inputs (file): all GeoJSON', function(t) {
  t.doesNotThrow(
    function() {
      new Omnivore('omnivore://' + datasets['multi-geojson'], function(err, src) {
        if (err) throw err;
        src.getInfo(function(err, info) {
          if (err) { throw err; }
          if (info.vector_layers.length != 2) {
            throw new Error('Expected two vector layers.');
          }
          t.end();
        });
      });
    },
    'does not throw on multiple GeoJSONs'
  );
});

test('multiple inputs (file): different types', function(t) {
  var multitypes = {
    'geojson+tif': 'omnivore://' + datasets['geojson'] + ',' + datasets['tif'],
    'csv+kml': 'omnivore://' + datasets['csv'] + ',' + datasets['kml']
  };
  var q = queue();
  for (var mt in multitypes) {
    q.defer(testMultitypes, mt, multitypes[mt]);
  }

  q.await(function() {
    t.end();
  });

  function testMultitypes(types, uri, next) {
    new Omnivore(uri, function(err) {
      t.equal(err.message, 'Multiple files allowed for GeoJSON only.', 'got error for ' + types);
      next();
    });
  }
});

test('build bridges', function(t) {
  var q = queue();

  for (var type in datasets) {
    q.defer(testDataset, type);
  }

  q.await(function() {
    t.end();
  });

  function testDataset(type, callback) {
    var uri = 'omnivore://' + datasets[type];
    new Omnivore(uri, function(err, src) {
      t.ifError(err, 'source ready for ' + type);
      src.getInfo(function(err, info) {
        t.ifError(err, 'got info for ' + type);
        t.notOk(tilelive.verify(info), 'info is valid');
        src.close(function(err) {
          t.ifError(err, 'closed source for ' + type);
          callback();
        });
      });
    });
  }
});

test('info contains vector_layers', function(t) {
  var uri = 'omnivore://' + datasets.shp;
  new Omnivore(uri, function(err, src) {
    t.ifError(err, 'source ready for shp');
    src.getInfo(function(err, info) {
      t.ifError(err, 'got info for shp');
      t.ok(info.vector_layers, 'has vector_layers');
      src.close(function(err) {
        t.ifError(err, 'closed source for shp');
        t.end();
      });
    });
  });
});

test('getTile returns tiles for gdal source', function(t) {
  var uri = 'omnivore://' + datasets.tif;
  new Omnivore(uri, function(err, src) {
    t.ifError(err, 'source ready for tif');
    src.getTile(8, 8, 8, function(err, data, headers) {
      t.ifError(err, 'got tiles for tif');
      t.ok(data, 'has data');
      t.ok(headers, 'has headers');
      src.close(function(err) {
        t.ifError(err, 'closed source for tif');
        t.end();
      });
    });
  });
});

test('getTile returns tiles for ogr source', function(t) {
  var uri = 'omnivore://' + datasets.kml;
  new Omnivore(uri, function(err, src) {
    t.ifError(err, 'source ready for kml');
    src.getTile(1, 1, 1, function(err, data, headers) {
      t.ifError(err, 'got tiles for kml');
      t.ok(data, 'has data');
      t.ok(headers, 'has headers');
      src.close(function(err) {
        t.ifError(err, 'closed source for kml');
        t.end();
      });
    });
  });
});

test('getTile returns tiles for geojson source', function(t) {
  var uri = 'omnivore://' + datasets.geojson;
  new Omnivore(uri, function(err, src) {
    t.ifError(err, 'source ready for geojson');
    src.getTile(13, 2342, 3132, function(err, data, headers) {
      t.ifError(err, 'got tile for geojson');
      t.ok(data, 'has data');
      t.ok(headers, 'has headers');
      src.close(function(err) {
        t.ifError(err, 'closed source for geojson');
        t.end();
      });
    });
  });
});

test('can override layer name via uri', function(t) {
  var uri = 'omnivore://' + datasets.geojson + '?layerName=named';
  new Omnivore(uri, function(err, src) {
    t.ifError(err, 'source ready for geojson');
    src.getTile(13, 2342, 3132, function(err, data) {
      t.ifError(err, 'got tile for geojson');

      zlib.gunzip(data, function(err, unzipped) {
        if (err) return t.end(err);
        var tile = new VectorTile(new Protobuf(unzipped));
        t.deepEqual(Object.keys(tile.layers), ['named'], 'renamed layer in vector tile');
        src.close(function(err) {
          t.ifError(err, 'closed source for geojson');
          t.end();
        });
      });
    });
  });
});

// test CLI command `mapnik-omnivore`
test('[bin/mapnik-omnivore] errors if not passed valid path', function(assert) {
  var args = [OmnivoreBin];

  spawn(process.execPath, args)
    .on('error', function(err) {
      assert.ok(err, 'should error');
    })
    .on('close', function(code) {
      assert.equal(code, 1, 'exit 1');
      assert.end();
    })
    .stderr.pipe(process.stdout);
});

test('[bin/mapnik-omnivore] runs on an absolute file path', function(assert) {
  var args = [OmnivoreBin, datasets.geojson];

  spawn(process.execPath, args)
    .on('error', function(err) {
      assert.ifError(err, 'should not error');
    })
    .on('close', function(code) {
      assert.equal(code, 0, 'exit 0');
      assert.end();
    })
    .stderr.pipe(process.stdout);
});

test('[bin/mapnik-omnivore] runs on a relative file path', function(assert) {
  var options = {
    cwd: path.resolve(__dirname, '..', 'node_modules')
  };
  var args = [OmnivoreBin, path.relative(options.cwd, datasets.geojson)];

  spawn(process.execPath, args, options)
    .on('error', function(err) {
      assert.ifError(err, 'should not error');
    })
    .on('close', function(code) {
      assert.equal(code, 0, 'exit 0');
      assert.end();
    })
    .stderr.pipe(process.stdout);
});
