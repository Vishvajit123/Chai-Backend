import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const registerUser = asyncHandler(async (req, res) => {
    // get user details from frontend  //from postman
    // validation - not empty
    // check if user is already exists : username, email
    // check for images, check for avatar
    // upload them to cloudinary, avtar
    // create user object - create entry in db 
    // remove password and refresh token field from response
    // check for user creation
    // return response

    // get user details from frontend  //from postman
    const { username, email, fullName, password } = req.body;
    console.log("email : ", email);

    // basic logic to check the field is empty or not
    // if(username === ""){
    //     throw new ApiError(400, "username is required");
    // }

    // if any of the field is empty it will return true
    // The .some() method checks whether at least one element in the array meets a certain condition.
    if ([username, email, fullName, password].some((field) => field?.trim() === "")
    ) {
        throw new ApiError(400, "All fields are required")
    }

    // check if user is already exists : username, email
    const existedUser = User.findOne({ $or: [{ username }, { email }] })
    if (existedUser) {
        throw new ApiError(409, "User with this username or email is already exist")
    }

    // check for images check for avatar
    const avatarLocalPath = req.files?.avatar[0]?.path;
    const coverImageLocalPath = req.files?.coverImage[0]?.path;
 
    if (!avaterLocalPath) {
        throw new ApiError(400, "Avatar file is Required");
    }

    // upload on cloudinary        
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);
    // check for avatar again
    if (!avatar) {
        throw new ApiError(400, "Avatar file is Required");
    }

    // create user object - create entry on Database
    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase(),
    })

    // remove password and refresh token field from response
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    );

    if (!createdUser) {
        throw new ApiError(500, "Something went Wrong While Registring the User");
    }

    // return response
    return res.status(201).json(
        new ApiResponse(200, createdUser, "User Register Successfully")
    )



})

export { registerUser }; 