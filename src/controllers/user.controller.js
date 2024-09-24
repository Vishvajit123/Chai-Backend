import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

// method to generate access and refresh tokens
const generateAccessAndRefreshTokens = async (userId) => {
    try {
        // find user
        const user = await User.findById(userId);
        // console.log(userId);
        // console.log(user);
        // gen accessToken and refreshToken
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        // save refresh token on our db so every time we will not ask password from user
        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false })

        // return both the tokens 
        return { accessToken, refreshToken }

    } catch (error) {
        throw new ApiError(500, "Something Went Wrong While Generating Access and Refresh Tokens")
    }
};

// register User
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
    // console.log("email : ", email);

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
    const existedUser = await User.findOne({ $or: [{ username }, { email }] })
    if (existedUser) {
        throw new ApiError(409, "User with this username or email is already exist")
    }

    // check for images check for avatar
    const avatarLocalPath = req.files?.avatar?.[0]?.path;
    const coverImageLocalPath = req.files?.coverImage?.[0]?.path;
    // console.log(req.files);

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is Required");
    }

    // upload on cloudinary        
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    // const coverImage = await uploadOnCloudinary(coverImageLocalPath);
    const coverImage = coverImageLocalPath ? await uploadOnCloudinary(coverImageLocalPath) : null;
    // check for avatar again
    if (!avatar) {
        throw new ApiError(400, "Failed to upload avatar file");
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

// Login User
const loginUser = asyncHandler(async (req, res) => {
    // get details from post man , username , password, email
    // username or email 
    // find the user
    // check the password
    // access and refresh token generate
    // send token using cookies
    // send respons in cookie
    const { email, username, password } = req.body;
    console.log("username : ", username + " email : ", email);
    if (!username && !email) {
        throw new ApiError(400, "username or email is required");
    }

    //find user from db based on username or email 
    const user = await User.findOne({ $or: [{ username }, { email }] })
    if (!user) {
        throw new ApiError(404, "user does not exist");
    }

    // check for password
    const isPasswordValid = await user.isPasswordCorrect(password)
    if (!password) {
        throw new ApiError(401, "Password Incorrect");
    }

    // destructur access and refresh token from generateAccesTokenAndRefreshToken()
    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id)

    // find that user is logged in if logged in not send password and refreshToken
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    // send cookies
    // this cokkies are basically modified by frontEnd side so that's why we use this so only server side person can modify it
    const options = {
        httpOnly: true,
        secure: true,
    }

    // send response
    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(200, {
                user: loggedInUser, accessToken, refreshToken
            },
                "User Logged in Succesfully"
            )
        )
})

// logoutUser 
const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(req.user._id,
        { $set: { refreshToken: undefined } },
        { new: true }
    )

    const options = {
        httpOnly: true,
        secure: true,
    }

    return res
        .status(200)
        .clearCookie("accessToken", options)   //method from cookie parser
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, {}, "User Logged Out"))
})

// refresh acces token endpoint
const refreshAccessToken = asyncHandler(async (req, res) => {
    // access refresh token from cookiss and if user is using aap the from body and store it in variable
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

    // check its present or not
    if (!incomingRefreshToken) {
        throw new ApiError(404, "Unauthorized Request");
    }

    // if present then verify and store in a variable
    try {
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)

        // find user 
        const user = await User.findById(decodedToken?._id)
        // check user    
        if (!user) {
            throw new ApiError(401, "Invalid Refresh Token");
        }
        // if we got user then check the incommingRefreshToken and refresh token which is present in our database is equal or not
        if (incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "Refresh Token is expired or Used")
        }
        // if matched then verification ho gaya hee to ab new generate karke dedo
        const options = {
            httpOnly: true,
            secure: true,
        }

        const { accessToken, newRefreshToken } = await generateAccessAndRefreshTokens(user._id)


        // return response
        return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", newRefreshToken, options)
            .json(
                new ApiResponse(200, { accessToken, refreshToken: newRefreshToken }
                    , "Access Token Refreshed"
                )
            )
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token")
    }
})

// change current password
const changeCurrentPassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body;

    // find user
    const user = await User.findById(req.user?._id)

    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    //check pass is correct or not
    if (!isPasswordCorrect) {
        throw new ApiError(400, "Invalid Old Password")
    }

    //set new pass
    user.password = newPassword
    await user.save({ validateBeforeSave: false })

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Password Changed Successfully"))
})

// get current user
const getCurrentUser = asyncHandler(async (req, res) => {
    return res
        .status(200)
        .json(new ApiResponse (200, req.user, "Current user fetched successfully"))
})

//update account details
const updateAccountDetails = asyncHandler(async (req, res) => {
    const { fullName, email } = req.body;

    if (!(fullName || email)) {
        throw new ApiError(400, "All Fields are Required")
    }

    //find user and update
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullname: fullName,
                email: email,
            }
        },
        { new: true }      //after update new info will get 
    ).select("-password")
    return res
        .status(200)
        .json(new ApiResponse(200, user, "Account Details Updated Successfully"))
})

// update user Avtar //image
const updateUserAvatar = asyncHandler(async (req, res) => {
    // find path
    const avatarLocalPath = req.file?.path
    // if it is not present throw error
    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar File is Missing");
    }
    // if present upload on cloudinary
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    // if not then throw error
    if (!avatar.url) {
        throw new ApiError(400, "Error While Uploading Avatar On Cloudinary");
    }
    // find user and update
    const user = await User.findByIdAndUpdate(req.user?._id,
        {
            $set: {
                avatar: avatar.url
            }
        },
        { new: true }
    ).select("-password")
    return res()
        .status(200)
        .json(new ApiResponse(200, user, "Avatar Updated Successful"));
})

// update user cover Image
const updateUserCoverImage = asyncHandler(async (req, res) => {
    // find path
    const coverImageLocalPath = req.file?.path
    // if it is not present
    if (!coverImageLocalPath) {
        throw new ApiError(404, "coverImage is Missing")
    }
    //if present then upload on cloudinary
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);
    // if Not
    if (!coverImage.url) {
        throw new ApiError(404, "Error While Uploading coverImage On Cloudinary")
    }
    // find user and update coverImage
    const user = User.findByIdAndUpdate(req.user?._id,
        {
            $set: {
                coverImage: coverImage.url
            }
        },
        { new: true }
    ).select("-password")
    return res()
        .status(200)
        .json(
            new ApiResponse(200, user, "coverImage Updated Successful"));
})

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,

}; 