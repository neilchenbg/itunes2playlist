import path from 'path';
import * as plist from 'plist';
import * as m3u from 'm3u';
import {decode} from 'urlencode';
import {isArray} from 'underscore';
import {traceNotice, traceError} from './service/log';
import {
  readFile,
  writeFile,
  deleteFile,
  copyFile,
  readFileAsJSON,
  writeFileAsJSON,
  writeFileWithBOM,
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
    this.rootPath = '';
    this.playlistPath = '';
    this.volumioPlaylistPath = '';
  }

  traceError(message, funcName) {
    traceError(message, 'App', funcName);
  }

  traceNotice(message, funcName) {
    traceNotice(message, 'App', funcName);
  }

  loadItunesLibrary(libraryPath) {
    let that = this;

    return new Promise((resolve, reject) => {
      readFile(libraryPath)
        .then((result) => {
          let library = {};

          try {
            library = plist.parse(result);
          } catch(e) {
            that.traceError(e.toString(), 'loadItunesLibrary');
            reject(`無法解析資料庫XML檔案，路徑: ${libraryPath}`);
          }

          resolve(library);
        })
        .catch((error) => {
          that.traceError(error, 'loadItunesLibrary');
          reject(`無法讀取資料庫XML檔案，路徑: ${libraryPath}`);
        });
    });
  }

  getPlaylistsAndTracksFromLibrary(library) {
    let that = this,
        playLists = [],
        trackIds = [],
        tracks = {},
        playListRPath = path.relative(that.playlistPath, that.rootPath + 'iTunes Media') + '/';

    playListRPath = playListRPath.replace('\\', '/');

    if (library['Playlists'] && isArray(library['Playlists']) && library['Playlists'].length > 0) {
      for (let playList of library['Playlists']) {
        if (
          playList['Name'] &&
          playList['Name'].indexOf(that.settings.playlistPrefix + '_') != -1 &&
          playList['Playlist Items'] &&
          isArray(playList['Playlist Items'])
        ) {
          let tmpTrackIds = [];

          for (let playListItem of playList['Playlist Items']) {
            if(library['Tracks'][playListItem['Track ID']]) {
              trackIds[trackIds.length] = playListItem['Track ID'];
              tmpTrackIds[tmpTrackIds.length] = library['Tracks'][playListItem['Track ID']]['Persistent ID'];
            }
          }

          playLists[playLists.length] = {
            pid: playList['Playlist Persistent ID'],
            name: playList['Name'].replace(that.settings.playlistPrefix + '_', ''),
            tracks: tmpTrackIds
          };
        }
      }
    }

    trackIds = [...new Set(trackIds)];

    for (let trackId of trackIds) {
      if (!library['Tracks'][trackId]) {
        continue;
      }

      let trackItem = library['Tracks'][trackId],
          trackSrc = decode(trackItem['Location']);

      let [trackPID, trackName, trackArtist, trackAlbum, trackDiskNumber, trackNumber, trakcExt, trackModified, trackTotalTime] = [
            trackItem['Persistent ID'],
            trackItem['Name'],
            trackItem['Artist'],
            trackItem['Album'],
            trackItem['Disc Number'] ? trackItem['Disc Number'] : 1,
            trackItem['Track Number'] ? trackItem['Track Number'] : 1,
            trackSrc.split('.').pop(),
            trackItem['Date Modified'],
            Math.ceil(trackItem['Total Time'] / 1000)
          ];

      let trackNewName = playListRPath + trackSrc.replace(decode(library['Music Folder']), '');
      
      tracks[trackPID] = {
        pid: trackPID,
        title: `${trackName} - ${trackArtist}`,
        name: trackName,
        artist: trackArtist,
        album: trackAlbum,
        path: trackNewName,
        src: trackSrc,
        time: trackTotalTime,
        modified: trackModified
      };
    }

    return [playLists, tracks];
  }

  updatePlaylists(playlists, tracks) {
    let that = this;

    return new Promise((resolve, reject) => {
      readDir(that.playlistPath)
        .then((result) => {
          let promiseArray = [];

          for (let entryName of result) {
            if (entryName.split('.').pop() == 'm3u') {
              promiseArray[promiseArray.length] = deleteFile(`${that.playlistPath}${entryName}`);
            }
          }

          return Promise.all(promiseArray);
        })
        .then((result) => {
          let promiseArray = [];

          for (let playList of playlists) {
            let m3uWriter = m3u.extendedWriter(),
                writeFunc = that.settings.playlistBOM && that.settings.playlistBOM == true ? writeFileWithBOM : writeFile;

            m3uWriter.comment(`Play list create by ${that.package.name}, author: ${that.package.author}`);
            m3uWriter.write();

            for (let trackPID of playList.tracks) {
              if (tracks[trackPID]) {
                let [m3uPath, m3uTime, m3uTitle] = [
                  tracks[trackPID]['path'],
                  tracks[trackPID]['time'],
                  tracks[trackPID]['title']
                ];
                m3uWriter.file(m3uPath, m3uTime, m3uTitle);
              }
            }

            promiseArray[promiseArray.length] = writeFunc(`${that.playlistPath}${playList.name}.m3u`, m3uWriter.toString());
          }

          return Promise.all(promiseArray);
        })
        .then((result) => {
          that.traceNotice(`處理播放清單完成`, 'updatePlaylists');
          resolve();
        })
        .catch((error) => {
          that.traceError(error, 'updatePlaylists');
          reject(`處理播放清單錯誤`);
        });
    });
  }

  updateVolumioPlaylist(playlists, tracks) {
    let that = this;
    let writeFunc = that.settings.playlistBOM && that.settings.playlistBOM == true ? writeFileWithBOM : writeFile;

    return new Promise((resolve, reject) => {
      readDir(that.volumioPlaylistPath)
        .then((result) => {
          let promiseArray = [];

          for (let entryName of result) {
            promiseArray[promiseArray.length] = deleteFile(`${that.volumioPlaylistPath}${entryName}`);
          }

          return Promise.all(promiseArray);
        })
        .then((result) => {
          let promiseArray = [];

          for (let playList of playlists) {
            var tmp = [];

            for (let trackPID of playList.tracks) {
              if (tracks[trackPID]) {
                let [trackPath, trackTitle, trackArtist, trackAlbum] = [
                  tracks[trackPID]['path'],
                  tracks[trackPID]['name'],
                  tracks[trackPID]['artist'],
                  tracks[trackPID]['album']
                ];

                tmp[tmp.length] = {
                  service: 'mpd',
                  uri: trackPath.replace('../', ''),
                  title: trackTitle,
                  artist: trackArtist,
                  album: trackAlbum,
                  albumart: encodeURI(`/albumart?path=/mnt/iTunes Media/Music/${trackArtist}/${trackAlbum}`)
                };
              }
            }

            promiseArray[promiseArray.length] = writeFunc(`${that.volumioPlaylistPath}${playList.name}`, JSON.stringify(tmp));
          }

          return Promise.all(promiseArray);
        })
        .then((result) => {
          that.traceNotice(`處理Volumio播放清單完成`, 'updateVolumioPlaylist');
          resolve();
        })
        .catch((error) => {
          that.traceError(error, 'updatePlaylists');
          reject(`處理Volumio播放清單錯誤`);
        });;
    });
  }

  run() {
    let that = this;

    return new Promise((resolve, reject) => {
      Promise
        .all([
          readFileAsJSON('settings.json'),
          readFileAsJSON('package.json')
        ])
        .then((result) => {
          [that.settings, that.package] = result;
          that.rootPath = `${path.parse(that.settings.itunesXMLPath).dir}/`;
          that.playlistPath = `${that.rootPath}_${that.package.name}/`;
          that.volumioPlaylistPath = `${that.rootPath}_${that.package.name}/volumio/`;
          that.traceNotice(`載入設定檔案完成`, 'run');

          return mkDir(that.playlistPath);
        })
        .then((result) => {
          that.traceNotice(`建立播放清單資料夾 "${that.playlistPath}" 完成`, 'run');

          return mkDir(that.volumioPlaylistPath);          
        })
        .then((result) => {
          that.traceNotice(`建立播放清單資料夾(Volumio) "${that.volumioPlaylistPath}" 完成`, 'run');

          return that.loadItunesLibrary(that.settings.itunesXMLPath);
        })
        .then((result) => {
          that.traceNotice(`讀取itunes資料庫完成，資料庫版本: ${result['Application Version']}`, 'run');

          let [playlists, tracks] = that.getPlaylistsAndTracksFromLibrary(result);

          return Promise.all([
            that.updatePlaylists(playlists, tracks),
            that.updateVolumioPlaylist(playlists, tracks)
          ]);
        })
        .then((result) => {
          resolve('執行完成');
        })
        .catch((error) => {
          that.traceError(error, 'run');
          reject('執行失敗');
        });
    });
  }
}

let app = new App();
app
  .run()
  .then((result) => {
    console.log(result);
  })
  .catch((error) => {
    console.log(error);
  });