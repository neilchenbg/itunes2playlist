import * as plist from 'plist';
import * as m3u from 'm3u';
import {isArray} from 'underscore';
import {traceNotice, traceError} from './service/log';
import {
  readFile,
  writeFile,
  deleteFile,
  copyFile,
  readFileAsJSON,
  writeFileAsJSON,
  mkDir,
  readDir,
  checkDir,
  checkFile
} from './node/file';

class App {
  App() {
    this.settings = {};
    this.package = {};
    this.tracks = {};
    this.playlistPath = '';
  }

  traceError(message, funcName) {
    traceError(message, 'App', funcName);
  }

  traceNotice(message, funcName) {
    traceNotice(message, 'App', funcName);
  }

  run() {
    console.log('Yo!');
  }
}

let app = new App();
app
  .run();
//   .then((result) => {
//     console.log(result);
//   })
//   .catch((error) => {
//     console.log(error);
//   });