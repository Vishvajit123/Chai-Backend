import {v2 as cloudinary} from "cloudinary";
import { response } from "express";
import fs from "fs";

// Configuration
cloudinary.config({ 
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
    api_key: process.env.CLOUDINARY_API_KEY, 
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadOnCloudinary = async (localFilePath) => {
    try {
        if(!localFilePath) return null;
        
        //upload the file on cloudinary
        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto"
        })
        // console.log("File is Uploaded on Cloudinary", response.url);
        // Remove the local file after successful upload
        fs.unlinkSync(localFilePath);
        return response;
    } catch (error) {
        console.error("Error uploading file to Cloudinary:", error);
        fs.unlinkSync(localFilePath); // remove the locally saved temporary file as the upload operation got failed 
        return null;
    }
}

const deleteFromCloudinary = async (publicId, resourceType = "image") => {
    try {
        // Delete the Asset with Given Public Id
        await cloudinary.uploader.destroy(publicId, {resource_type: resourceType});
        return response;
    } catch (error) {
        console.log("Error while Deleting Assets from Cloudinary", error.message);
        return null;
    }
}


export {uploadOnCloudinary, deleteFromCloudinary}
