const mongoose = require('mongoose');
const connect = mongoose.createConnection('mongodb://localhost:27017/file_server', {
  serverSelectionTimeoutMS: 5000,
  useNewUrlParser: true,
  useCreateIndex: true,
  useFindAndModify: false,
  useUnifiedTopology: true,
});
connect.once('open', () => {
  console.info('mongoose|connect|open');
});
connect.once('error', (error) => {
  console.error('mongoose|connect|error', error);
  process.exit(1);
});

const Schema = mongoose.Schema;

const schemaFiles = new Schema({
  user_id: {
    type: Number,
    index: true
  },
  serverDomain: {
    type: String,
  },
  public: {
    type: Boolean,
    default: true,
  },
  data: {
    type: {},
  },
  md5: {
    type: String,
    index: true
  },
  filePath: {
    type: String,
  }
}, {timestamps: true});
module.exports.ModelFiles = connect.model('files', schemaFiles);

const schemaUsers = new Schema({
  token: {
    type: String,
    index: true
  },
  user_id: {
    type: Number,
    required: true,
    index: true
  }
}, {timestamps: true});
module.exports.ModelUsers = connect.model('users', schemaUsers);
