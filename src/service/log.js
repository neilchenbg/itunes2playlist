import {isArray} from 'underscore';

const _getCurrentDateTime = () => {
  let objDate = new Date();
  return [
    [objDate.getFullYear(), objDate.getMonth(), objDate.getDate()].join('-'), [objDate.getHours(), objDate.getMinutes(), objDate.getSeconds()].join(':')
  ].join(' ');
};

const trace = (message, moduleName, type, funcName = undefined) => {
  let logString = [];

  logString[logString.length] = ['[', _getCurrentDateTime(), ']'].join('');
  logString[logString.length] = ['[', type, ']'].join('');

  if (funcName) {
    logString[logString.length] = ['[', [moduleName, funcName].join('::'), ']'].join('');
  } else {
    logString[logString.length] = ['[', moduleName, ']'].join('');
  }

  logString[logString.length] = [' ', message].join('');

  console.log(logString.join(''));
};

const traceNotice = (message, moduleName, funcName) => {
  trace(message, moduleName, 'NOTICE', funcName);
};

const traceError = (message, moduleName, funcName) => {
  trace(message, moduleName, 'ERROR', funcName);
};

export default trace;

export {
  trace,
  traceNotice,
  traceError
};