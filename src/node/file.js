import {traceNotice, traceError} from '../service/log';
import {
  readFile as fsReadFile,
  writeFile as fsWriteFile,
  unlink as fsDeleteFile,
  mkdir as fsMkDir,
  readdir as fsReaddir,
  stat as fsStat
} from 'fs';
import {
  copy as fsCopy
} from 'fs-extra';

const _traceError = (message, funcName) => {
  traceError(message, 'node.file', funcName);
};

const _traceNotice = (message, funcName) => {
  traceNotice(message, 'node.file', funcName);
};

const checkFile = (path) => {
  return new Promise((resolve, reject) => {
    fsStat(path, (error, result) => {
      if(!error) {
        if(result.isFile()) {
          resolve();
        } else {
          reject(`Path "${path}" is not a file`);
        }
      } else {
        if(error.code == 'ENOENT') {
          reject(`Path "${path}" not found`);
        } else {
          _traceError(error.toString(), checkFile.name);
          reject(`Failure to check file "${path}"`);
        }
      }
    });
  });
};

const checkDir = (path) => {
  return new Promise((resolve, reject) => {
    fsStat(path, (error, result) => {
      if(!error) {
        if(result.isDirectory()) {
          resolve();
        } else {
          reject(`Path "${path}" is not a directory`);
        }
      } else {
        if(error.code == 'ENOENT') {
          reject(`Path "${path}" not found`);
        } else {
          _traceError(error.toString(), checkFile.name);
          reject(`Failure to check directory "${path}"`);
        }
      }
    });
  });
};

const readFile = (path) => {
  return new Promise((resolve, reject) => {
    fsReadFile(path, 'utf-8', (error, result) => {
      if(!error) {
        resolve(result);
      } else {
        _traceError(error.toString(), readFile.name);
        reject(`Failure to read file "${path}"`);
      }
    });
  });
};

const writeFile = (path, content) => {
  return new Promise((resolve, reject) => {
    fsWriteFile(path, content, 'utf-8', (error) => {
      if(!error) {
        resolve();
      } else {
        _traceError(error.toString(), writeFile.name);
        reject(`Failure to write file "${path}"`);
      }
    });
  });
};

const deleteFile = (path) => {
  return new Promise((resolve, reject) => {
    fsDeleteFile(path, (error, result) => {
      if(!error) {
        resolve(result);
      } else {
        _traceError(error.toString(), deleteFile.name);
        reject(`Failure to delete file "${path}"`);
      }
    });
  });
};

const copyFile = (src, dest) => {
  return new Promise((resolve, reject) => {
    fsCopy(src, dest, {clobber: true}, (error) => {
      if(!error) {
        resolve();
      } else {
        _traceError(error.toString(), copyFile.name);
        reject(`Failure to copy file "${src}" to "${dest}"`);
      }
    });
  });
};

const readFileAsJSON = (path) => {
  return new Promise((resolve, reject) => {
    readFile(path)
      .then((result) => {
        let json = {};

        try {
          json = JSON.parse(result);
        } catch(error) {
          _traceError(error.toString(), readFileAsJSON.name);
          reject(`File "${path}" format is not correct`);
        }

        resolve(json);
      })
      .catch((error) => {
        _traceError(error.toString(), readFileAsJSON.name);
        reject(`Failure to read file "${path}"`);
      })
  });
};

const writeFileAsJSON = (path, json) => {
  return fsWriteFile(path, JSON.stringify(json), 'utf-8');
};

const mkDir = (path) => {
  return new Promise((resolve, reject) => {
    checkDir(path)
      .then((result) => {
        resolve();
      })
      .catch((error) => {
        fsMkDir(path, (error) => {
          if(!error) {
            resolve();
          } else {
            _traceError(error.toString(), mkDir.name);
            reject(`Failure to create directory "${path}"`);
          }
        });
      });
  });
};

const mkDirRev = (path, pathRoot = '') => {
  return new Promise((resolve, reject) => {
    let pathArray = path.split('/'),
        mkDirArray = [],
        promiseArray = [],
        num = 0;

    for (let dirName of pathArray) {
      if (num != 0 && dirName == '') {
        continue;
      }

      mkDirArray[mkDirArray.length] = dirName;
      promiseArray[promiseArray.length] = mkDir(pathRoot + mkDirArray.join('/') + '/');

      num ++;
    }

    Promise
      .all(promiseArray)
      .then(function(result) {
        resolve(result);
      })
      .catch(function(error) {
        _traceError(error, mkDirRev.name);
        reject(error);
      });
  });
};

const readDir = (path) => {
  return new Promise((resolve, reject) => {
    fsReaddir(path, (error, list) => {
      if(!error) {
        resolve(list);
      } else {
        _traceError(error.toString(), readDir.name);
        reject(`Failure to read directory "${path}"`);
      }
    });
  });
};

export {
  checkFile,
  checkDir,
  readFile,
  writeFile,
  deleteFile,
  copyFile,
  readFileAsJSON,
  writeFileAsJSON,
  mkDir,
  mkDirRev,
  readDir
};