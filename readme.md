# tilelive-omnivore

Implements the tilelive api for a variety of raw data sources

## Install

```
npm install -g tilelive-omnivore
```

## Example

```javascript
var Omnivore = require('tilelive-omnivore');
var filepath = '/absolute/path/to/geographic/data';
var uri = 'omnivore://' + filepath;

new Omnivore(uri, function(err, source) {
  source.getInfo(function(err, info) {
    console.log(info);
  });
});
```

## Works with

any file supported by [mapnik-omnivore](https://github.com/mapbox/mapnik-omnivore)
