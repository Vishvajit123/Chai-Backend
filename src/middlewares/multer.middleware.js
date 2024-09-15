// multer: This is a middleware for handling multipart/form-data, which is used for uploading files. It can handle file uploads through forms in web applications.
import multer from "multer";

// multer.diskStorage() is used to control how files are stored on the disk (file system) when uploaded.
const storage = multer.diskStorage({
    // destination: A function that determines where the uploaded files should be stored.
    // req: The request object.
    //  file: The uploaded file’s object.
    //  cb: A callback function (cb(null, path)) that you use to specify the storage location. 
  destination: function (req, file, cb) {
      cb(null, "./public/temp")
    },
    // filename: A function that determines the name of the uploaded file on the server.
    filename: function (req, file, cb) {
        cb(null, file.originalname)
    }
  })
  
 export const upload = multer({ storage, })