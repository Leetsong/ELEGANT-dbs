/* This is an easy script file to do patching for both
 * the DB.json file (required by FicFinder) and the
 * models.json file (required) by ELEGANT.
 * 
 * Put DB.json and models.json in this folder and simply 
 * run
 *   $ node patch.js
 * then DB.patched.json and models.patched.json will be
 * generated.
 * 
 * Note, this file cannot support the `important` mechanism.
 */
const path = require('path');
const fs = require('fs');
const SortedSet = require('collections/sorted-set');

const DB_FICFINDER_PATH = path.resolve(__dirname, './DB.json');
const DB_ELEGANT_PATH = path.resolve(__dirname, './models.json');

const DB_FICFINDER_PATCHED_PATH = path.resolve(__dirname, './DB.patched.json');
const DB_ELEGANT_PATCHED_PATH = path.resolve(__dirname, './models.patched.json');

var db_ficfinder = JSON.parse(fs.readFileSync(DB_FICFINDER_PATH));
var db_elegant = JSON.parse(fs.readFileSync(DB_ELEGANT_PATH));

var cache_index_ficfinder = {};
var cache_index_elegant = {};

var sig_set_ficfinder = new SortedSet([]);
var sig_set_elegant = new SortedSet([]);

// cache index in a set
db_elegant.forEach((m, i) => {
  if (m.api['@type'] === 'method') {
    cache_index_elegant[extract_signature(m)] = i;
    sig_set_elegant.add(extract_signature(m));;
  }
});

db_ficfinder.forEach((m, i) => {
  cache_index_ficfinder[m.APISignature] = i;
  sig_set_ficfinder.add(m.APISignature);
});

// patches for ficfinder
var set_patch_ficfinder = sig_set_elegant.difference(sig_set_ficfinder);
var set_patch_elegant = sig_set_ficfinder.difference(sig_set_elegant);

// add patches
set_patch_ficfinder.forEach(m => {
  const { api, context } = db_elegant[cache_index_elegant[m]];
  const {
    min_api_level,
    max_api_level,
    bad_devices,
    message
  } = context;

  var patch_model = { APISignature: m, conditions: {} };

  if (min_api_level && min_api_level !== 1) {
    patch_model.conditions.SDK = `${min_api_level}`;
  }

  if (max_api_level && max_api_level !== 27) {
    patch_model.conditions.postSDK = `${max_api_level}`;
  }

  if (bad_devices && bad_devices.length !== 0) {
    patch_model.conditions.Device = 
      bad_devices.reduce((a, b) => `${b},${a}`, "");
  }

  if (message && message !== '') {
    patch_model.conditions.additionalInfo = message;
  }

  db_ficfinder.push(patch_model);
});

set_patch_elegant.forEach(m => {
  const { conditions, additionalInfo } = db_ficfinder[cache_index_ficfinder[m]];
  const {
    SDK,
    postSDK,
    Device
  } = conditions;

  var patch_model = {
    api: extract_api(m),
    context: {}
  };

  if (additionalInfo && additionalInfo !== '') {
    patch_model.context.message = additionalInfo;
  }

  if (SDK) {
    patch_model.context.min_api_level = parseInt(SDK);
  }

  if (postSDK) {
    patch_model.context.max_api_level = parseInt(postSDK);
  }

  if (Device) {
    patch_model.context.bad_devices = Device.split(',');
  }

  db_elegant.push(patch_model);
});

fs.writeFileSync(DB_ELEGANT_PATCHED_PATH, JSON.stringify(db_elegant, null, 2));
fs.writeFileSync(DB_FICFINDER_PATCHED_PATH, JSON.stringify(db_ficfinder, null, 2));

function extract_api(m) {
  const sigReg = /^<(.*?): (.*?) (.*?)\((.*?)\)>$/;
  
  var extracted = sigReg.exec(m);

  var cls = extracted[1].split('.');
  var ret = extracted[2].split('.');
  var methodName = extracted[3];
  var paramList = extracted[4] === '' ? [] : extracted[4].split(',');

  var api = {
    '@type': 'method',
    pkg: '',
    iface: '',
    method: '',
    ret: {
      pkg: '',
      iface: ''
    },
    paramList: [
      {
        pkg: '',
        iface: ''
      }
    ]
  };

  api.pkg = cls.length === 1
            ? "" : cls.slice(0, cls.length - 1).join('.');
  api.iface = cls[cls.length - 1];

  api.method = methodName;

  api.ret.pkg = ret.length === 1 
                ? "" : ret.slice(0, ret.length - 1).join('.');
  api.ret.iface = ret[ret.length - 1];

  for (var i = 0; i < paramList.length; i ++) {
    var cc = paramList[i].split('.');
    api.paramList[i] = {
      pkg: cc.length === 1 
           ? "" : cc.slice(0, cc.length - 1).join('.'),
      iface: cc[cc.length - 1]
    };
  }

  return api;
}

function extract_signature({ api, context }) {
  var cls = `${api.pkg}.${api.iface}`;
  var ret = api.ret.pkg && api.ret.pkg !== '' 
              ? `${api.ret.pkg}.${api.ret.iface}`
              : `${api.ret.iface}`;
  var params = "";

  if (api.paramList && api.paramList.length !== 0) {
    for (var i = 0; i < api.paramList.length; i++) {
      if (i != 0) {
        params += ",";
      }
      params += api.paramList[i].pkg && api.paramList[i].pkg !== '' 
                ? `${api.paramList[i].pkg}.${api.paramList[i].iface}`
                : `${api.paramList[i].iface}`;
    }
  }

  return `<${cls}: ${ret} ${api.method}(${params})>`
}