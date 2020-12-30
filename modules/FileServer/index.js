/*
Требуется доработать
максимальный размер файла
 */

const fileScheme   = require('./scheme');
const fetch        = require('node-fetch');
const mime         = require('mime');
const fs           = require('fs');
const mkdirp       = require('mkdirp')
const moment       = require('moment');
const {promisify}  = require('util');
const sizeOf       = promisify(require('image-size'));
const fileType     = require('file-type');
const hasha        = require('hasha');
const {v4: uuidv4} = require('uuid');

const serverDomain = 'https://static1.waba.bot';

class FileServer {

  assignDirectory(user_id){

    let fileDir = user_id+moment().format('/YYYY/MM/');

    try {
      fs.statSync('/srv/www/api.waba.bot/nodejs/static_server/uploads/'+fileDir);
    } catch (e) {
      mkdirp.sync('/srv/www/api.waba.bot/nodejs/static_server/uploads/'+fileDir)
    }

    return fileDir
  }

  /**
   * Получить файл для отображения
   * @param req
   * @param res
   * @param fileId
   * @param download
   * @returns {Promise<*>}
   */
  async file({req, res, fileId, download}) {

    try {

      if (!fileId) {
        return res.status(400).send('File not found! fileId undefined');
      }

      const fileData = await fileScheme.ModelFiles.findOne({_id: fileId}).exec();
      if (!fileData)
        return res.status(400).send('File not found!');

      if(req.get('If-None-Match') === fileData.md5) return res.sendStatus(304);

      if (!fileData.public) {

        let token = req.get('SS_TOKEN');
        if(!token) {
          if(req.body.ss_token)
            token = req.body.ss_token;
          else return res.status(400).send('token invalid!');
        }

        const user = await fileScheme.ModelUsers.findOne({token}).exec();
        if (!user)
          return res.status(400).send('token invalid!');

        if (fileData.user_id !== user.user_id)
          return res.status(401).send('Unauthorized');
      }

      res.setHeader('Content-type', fileData.data.mimetype + '; charset=UTF-8');
      res.setHeader('Cache-Control', 'no-transform,' + (fileData.public ? 'public' : 'private') + ',max-age=300,s-maxage=900');
      res.setHeader('ETag', fileData.md5);

      //console.log('тут', 'Content-disposition', 'filename=' + fileData.data.name)

      if (download) {
        res.setHeader('Content-disposition', 'attachment; filename="' + encodeURIComponent(fileData.data.name) + '"');
      }
      else {
        res.setHeader('Content-disposition', 'filename="' + encodeURIComponent(fileData.data.name) + '"');
      }

      //console.log('/srv/www/api.waba.bot/nodejs/static_server/uploads/' + fileData.filePath);

      const fileStream = fs.createReadStream('/srv/www/api.waba.bot/nodejs/static_server/uploads/' + fileData.filePath);
      fileStream.pipe(res);

    } catch (e) {
      console.error(e);
      return res.status(400).send('File not found!');
    }
  }

  /**
   * Получить список файлов
   * @param req
   * @param res
   * @returns {Promise<any>}
   */
  async files({req, res}) {

    try {

      let token = req.get('SS_TOKEN');
      if(!token) {
        if(req.body.ss_token)
          token = req.body.ss_token;
        else return res.status(400).send('token invalid!');
      }

      const user = await fileScheme.ModelUsers.findOne({token}).exec();
      if (!user)
        return res.status(400).send('token invalid!');

      const fileData = await fileScheme.ModelFiles.find({user_id: user.user_id}).exec();
      if (!fileData)
        return res.status(400).send('Files not found!');

      return res.json(fileData);

    } catch (e) {
      return res.status(400).send('File not found!');
    }
  }

  /**
   * Загруска файла на сервер
   * @param req
   * @param res
   * @param token
   */
  async fileUpload({req, res}) {

    let token = req.get('SS_TOKEN');
    if(!token) {
      if(req.body.ss_token)
        token = req.body.ss_token;
      else return res.status(400).send('token invalid!');
    }

    const user = await fileScheme.ModelUsers.findOne({token}).exec();
    if (!user)
      return res.status(400).send('token invalid!');

    if (req.method === 'post' && req.body.option) {
      req.body.option = JSON.parse(req.body.option);
    }

    if (req.method === 'get' && req.query.option) {
      req.query.option = JSON.parse(req.query.option);
    }

    console.log(req.files)

    if (req.files && Object.keys(req.files).length > 0 && req.files.file)
      return this.fileUpload__file({file: req.files.file, option: req.body.option | {}, res, user});

    if (req.body && req.body.file_url !== undefined && req.body.file_url !== '')
      return this.fileUpload__fileUrl({file_url: req.body.file_url, option: req.body.option, res, user});

    if (req.query && req.query.file_url !== undefined && req.query.file_url !== '')
      return this.fileUpload__fileUrl({file_url: req.query.file_url, option: req.query.option, res, user});

    if (req.body && req.body.base64 !== undefined && req.body.base64 !== '')
      return this.fileUpload__fileBase64({base64: req.body.base64, option: req.body.option, res, user});

    return res.status(400).send('file null!');

  }

  async fileUpload__file({file, option = {}, res, user}) {

    if (file.truncated) {
      fs.unlinkSync(file.tempFilePath);
      return res.status(400).send('File size limit has been reached');
    }

    const fileHash = await hasha.fromFile(file.tempFilePath, {algorithm: 'sha512'});
    const ext      = mime.getExtension(file.mimetype);

    if (option.fileName) file.name = option.fileName;

    let d = {
      user_id: user.user_id,
      data   : {
        name    : file.name,
        size    : file.size,
        mimetype: file.mimetype,
        ext
      },
      md5    : fileHash
    };

    d.data.filetype = 'document';
    if (/^image\//.test(file.mimetype)) {
      d.data.dimensions = await sizeOf(file.tempFilePath);
      d.data.filetype   = 'image';
    }
    else if (/^audio\//.test(file.mimetype)) {
      d.data.filetype = 'audio';
    }
    else if (/^video\//.test(file.mimetype)) {
      d.data.filetype = 'video';
    }

    d.filePath = this.assignDirectory(user.user_id) + fileHash + '.' + ext;

    const fd = await new fileScheme.ModelFiles(d).save();

    await file.mv('/srv/www/api.waba.bot/nodejs/static_server/uploads/' + d.filePath, function (err) {
      if (err)
        return res.status(500).send(err);

      fd.serverDomain = serverDomain;
      res.json(fd);
    });

  }

  async fileUpload__fileUrl({file_url, option, res, user}) {

    option = Object.assign({
      fileName       : null,
      headers        : {},
      acceptFileTypes: null,
      maxSize        : 1024 * 1024 * 100,
      timeout        : 60000
    }, option || {});

    try {

      let fileData = await fetch(file_url, {
        method : 'GET',
        headers: option.headers,
        timeout: option.timeout,
      });

      if (!fileData.ok)
        return res.json({
          error: {
            msg: 'Не удалось скачать файл',
            e  : JSON.stringify(fileData)
          }
        });

      fileData = await fileData.buffer();

      let type;
      if (option.mimeType !== null) {
        type = {
          ext : mime.getExtension(option.mimeType),
          mime: option.mimeType
        };
      }
      else {
        type = await fileType.fromBuffer(fileData);
      }

      if (type === null || type === undefined || type.ext === undefined) {
        return res.json({
          error: {
            msg: 'Не удалось определить тип файла',
          }
        });
      }

      if (option.fileName === null) option.fileName = 'file.' + type.ext;

      const fileHash = await hasha.async(fileData, {algorithm: 'sha512'});
      const fileName = fileHash + '.' + type.ext
      const filePath = '/srv/www/api.waba.bot/nodejs/static_server/uploads/' + this.assignDirectory(user.user_id);

      try {
        fs.statSync(filePath);
      } catch (e) {
        fs.mkdirSync(filePath);
      }

      fs.appendFileSync(filePath + fileName, fileData);
      let stat       = fs.statSync(filePath + fileName);
      const mimetype = type.mime;

      if (stat.size > (50 * 1024 * 1024)) {
        fs.unlinkSync(filePath + fileName);
        return res.json({
          error: {
            msg: 'Файл превышает размер 50mb',
          }
        });
      }

      let d = {
        user_id: user.user_id,
        data   : {
          name: option.fileName,
          size: stat.size,
          mimetype,
          ext : type.ext
        },
        md5    : fileHash
      };

      d.data.filetype = 'document';
      if (/^image\//.test(mimetype)) {
        d.data.dimensions = await sizeOf(filePath + fileName);
        d.data.filetype   = 'image';
      }
      else if (/^audio\//.test(mimetype)) {
        d.data.filetype = 'audio';
      }
      else if (/^video\//.test(mimetype)) {
        d.data.filetype = 'video';
      }

      d.filePath = this.assignDirectory(user.user_id) + fileHash + '.' + type.ext;

      const fd = await new fileScheme.ModelFiles(d).save();

      fd.serverDomain = serverDomain;

      res.json(fd);

    } catch (e) {

      console.error(e)

      return res.json({
        error: {
          msg: 'Не удалось загрузить файла',
          e
        }
      });

    }

  }

  async fileUpload__fileBase64({base64, option, res, user}) {

    option = Object.assign({
      fileName       : null,
      headers        : {},
      acceptFileTypes: null,
      maxSize        : 1024 * 1024 * 100,
      timeout        : 60000
    }, option || {});

    const fileBuffer = this.decodeBase64Image(base64);

    if (!fileBuffer) return res.json({
      error: {
        msg: 'Не удалось загрузить файла'
      }
    });

    let type = {
      ext: mime.getExtension(fileBuffer.type)
    };

    let fileTmp = uuidv4();
    try {
      fs.writeFileSync('/srv/www/api.waba.bot/nodejs/static_server/tmp/' + fileTmp, fileBuffer.data, 'base64');
    } catch (e) {
      return res.json({
        error: {
          msg: 'Не удалось загрузить файла',
          e
        }
      });
    }

    const stat     = fs.statSync('/srv/www/api.waba.bot/nodejs/static_server/tmp/' + fileTmp);
    const fileHash = await hasha.fromFile('/srv/www/api.waba.bot/nodejs/static_server/tmp/' + fileTmp, {algorithm: 'sha512'});
    if (option.fileName === null)
      option.fileName = 'file.' + type.ext;
    else
      option.fileName = option.fileName + '.' + type.ext;

    let d = {
      user_id: user.user_id,
      data   : {
        name    : option.fileName,
        size    : stat.size,
        mimetype: fileBuffer.type,
        ext     : type.ext
      },
      md5    : fileHash
    };

    d.data.filetype = 'document';
    if (/^image\//.test(fileBuffer.type)) {
      d.data.dimensions = await sizeOf('/srv/www/api.waba.bot/nodejs/static_server/tmp/' + fileTmp);
      d.data.filetype   = 'image';
    }
    else if (/^audio\//.test(fileBuffer.type)) {
      d.data.filetype = 'audio';
    }
    else if (/^video\//.test(fileBuffer.type)) {
      d.data.filetype = 'video';
    }

    d.filePath = this.assignDirectory(user.user_id) + fileHash + '.' + type.ext;

    const fileName = fileHash + '.' + type.ext
    const fileDir = '/srv/www/api.waba.bot/nodejs/static_server/uploads/' + this.assignDirectory(user.user_id);

    try {

      fs.renameSync('/srv/www/api.waba.bot/nodejs/static_server/tmp/' + fileTmp, fileDir + fileName);
      fs.unlinkSync('/srv/www/api.waba.bot/nodejs/static_server/tmp/' + fileTmp);
      const fd = await new fileScheme.ModelFiles(d).save();

      fd.serverDomain = serverDomain;
      res.json(fd);

    } catch (e) {
      return res.json({
        error: {
          msg: 'Не удалось загрузить файла',
          e
        }
      });
    }

  }

  /**
   * Decoding base-64 file
   *
   *  Source: http://stackoverflow.com/questions/20267939/nodejs-write-base64-image-file
   * @param dataString
   * @returns {Error|{}}
   */
  decodeBase64Image(dataString) {

    const matches  = dataString.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    const response = {};

    if (matches.length !== 3) {
      return false;
    }

    response.type = matches[1];
    response.data = Buffer.from(matches[2], 'base64');

    return response;
  }

  /**
   * Удалить файл
   * @param req
   * @param res
   * @param fileId
   * @returns {Promise<*>}
   */
  async fileDelete({req, res, fileId}) {

    try {

      let token = req.get('SS_TOKEN');
      if(!token) {
        if(req.body.ss_token)
          token = req.body.ss_token;
        else return res.status(400).send('token invalid!');
      }

      if (!fileId) {
        return res.status(400).send('File not found! fileId undefined');
      }

      const fileData = await fileScheme.ModelFiles.findOne({_id: fileId}).exec();
      if (!fileData)
        return res.status(400).send('File not found!');

      const user = await fileScheme.ModelUsers.findOne({token}).exec();
      if (!user)
        return res.status(400).send('token invalid!');

      if (fileData.user_id !== user.user_id)
        return res.status(401).send('Unauthorized');

      await fileScheme.ModelFiles.deleteOne({_id: fileId}).exec();

      const fileData2 = await fileScheme.ModelFiles.findOne({md5: fileData.md5}).exec();
      if (!fileData2)
        fs.unlinkSync('/srv/www/api.waba.bot/nodejs/static_server/uploads/' + fileData.filePath);

      return res.send('');

    } catch (e) {
      return res.status(400).send('File not found!');
    }
  }

  /**
   * Получить данные файла
   * @param req
   * @param res
   * @returns {Promise<*>}
   */
  async file_data({req, res}) {

    try {

      if (req.params.fileId === undefined) {
        return res.status(400).send('File not found! fileId undefined');
      }

      const fileData = await fileScheme.ModelFiles.findOne({_id: req.params.fileId}, '-__v').exec();
      if (!fileData)
        return res.status(400).send('File not found!');

      fileData.serverDomain = serverDomain;
      res.json(fileData)

    } catch (e) {
      console.error(e);
      return res.status(400).send('File not found!');
    }

  }

}

const clsFileServer = new FileServer();
module.exports      = clsFileServer;