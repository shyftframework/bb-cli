var Q = require('q');
var fs = require('fs-extra');
var readJson = Q.denodeify(fs.readJson);
var _ = require('lodash');
var chalk = require('chalk');
var BBRest = require('mosaic-rest-js');
var jxon = require('jxon');

var HOME = process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
var iniDir;


exports.get = function(depth) {
    return exports.getGlobal()
    .then(function(g) {
        return exports.getConfig(depth)
        .then(function(c) {
            return exports.getLocal(depth)
            .then(function(l) {
                c._global = g;
                c._local = l;
                return c;
            }); 
        });
    });
}

exports.getGlobal = function() {
    return readJson(HOME + '/.backbase/config.json');
}

exports.getConfig = function(depth) {
    iniDir = process.cwd();
    return getNested('backbase.json', [], depth);
}

exports.getLocal = function(depth) {
    iniDir = process.cwd();
    return getNested('.bblocal.json', [], depth)
    .then(function(r) {
        if (r.path && r.path.substr(0, 1) === '~') r.path = HOME + r.path.substr(1);
        return r;
    });
}

exports.getCommon = function(depth) {
    return exports.get(depth)
    .then(function(config) {
        bbrest = new BBRest();
        bbrest.config = {
            host: config._local.host || bbrest.config.host,
            port: config._local.port || bbrest.config.port,
            context: config._local.context || bbrest.config.context,
            username: config._local.username || bbrest.config.username,
            password: config._local.password || bbrest.config.password,
            portal: config._local.portal || bbrest.config.portal,
            plugin: function (o) {return jxon.jsToString(o);}
        }
        jxon.config({
          valueKey: '_',        // default: 'keyValue'
          attrKey: '$',         // default: 'keyAttributes'
          attrPrefix: '$',      // default: '@'
          lowerCaseTags: false, // default: true
          trueIsEmpty: false,   // default: true
          autoDate: false       // default: true
        });
        return {
            config: config,
            bbrest: bbrest,
            jxon: jxon
        };
    });
}

function getNested(name, a, depth) {
    a = a || [];

    return readJson(name)
    .then(function(r) {
        a.push(r);
        return onRead(name, a, depth);
    })
    .fail(function(e) {
        // if no file, proceed
        if (e.code !== 'ENOENT') console.log(chalk.red('Error parsing file:'),  process.cwd() + '/' + name);
        return onRead(name, a, depth);
    });
}
function onRead(name, a, depth) {
    if (process.cwd() !== '/' && (depth !== undefined && depth > 0)) {
        process.chdir('..');
        if (depth !== undefined) depth--;
        return getNested(name, a, depth);
    } else {
        var o = {}, i;
        a.reverse();
        for (i = 0; i < a.length; i++) {
            _.merge(o, a[i]);
        }
        process.chdir(iniDir);
        return o;
    }
}

/*
// TEST
process.chdir('../test/mock1/nest');
exports.get(0)
.then(function(r) {
    console.log(r);
    console.log('done.');
});
*/