import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary, deleteFromCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

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
    if (!isPasswordValid) {
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
        { $unset: { refreshToken: 1 } }, //this removes the field from backend
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




// Add user control management endPoints
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
        .json(new ApiResponse(200, req.user, "Current user fetched successfully"))
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
                fullName: fullName,
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

    // Delete user Avatar/Image From Cloudinary
    // This code extract publicId of users avatar img from URL, It user a regular expression to find part of url that represent publicId, if publicId is Found , the Code proceeds to delete the avatar from user cloudinary, if not found the publicId throw error 

    // check user is exist and access the User's avatar image
    const avatarUrl = req.user?.avatar;
    // This regular expression is designed to extract the public ID of the avatar from the URL.
    const regex = /\/([^/]+)\.[^.]+$/;
    // Matching the URL with the Regular Expression
    const match = avatarUrl.match(regex);
    // If the match is null
    if(!match){
        throw new ApiError(400, "Couldn't find Public Id of Old Avatar");
    }
    // If the match is successful, match[1] contains the public ID extracted by the regular expression
    const publicId = match[1];
    await deleteFromCloudinary(publicId);

    // find user and update
    const user = await User.findByIdAndUpdate(req.user?._id,
        {
            $set: {
                avatar: avatar.url
            }
        },
        { new: true }
    ).select("-password -refreshToken");
    return res
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

    // find coverImage url form cloudinary and delete 
    const coverImageUrl = req.user?.coverImage;
    const regex = /\/([^/]+)\.[^.]+$/;
    const match = coverImageUrl.match(regex);
    if(!match){
        throw new ApiError(400, "Error While find publicId of coverImage on Cloudinary")
    }
    const publicId = match[1];
    await deleteFromCloudinary(publicId);

    // find user and update coverImage
    const user = await User.findByIdAndUpdate(req.user?._id,
        {
            $set: {
                coverImage: coverImage.url
            }
        },
        { new: true }
    ).select("-password")
    return res
        .status(200)
        .json(
            new ApiResponse(200, user, "coverImage Updated Successful"));
})



// get user channel profile
const getUserChannelProfile = asyncHandler(async (req, res) => {
     // Extract the username from the request parameters (req.params)
    const { username } = req.params;
    // Check if the username is missing 
    if (!username) {
        throw new ApiError(400, 'Username is missing');
    }
    
    // if present then find the document
    // Perform an aggregation on the User collection to retrieve the user's profile and related data
    // The User.aggregate() method is used to perform an aggregation pipeline operation on the User collection in MongoDB.
const channel = await User.aggregate([
        {
            // Match the user by comparing the lowercase username from the request with the one stored in the database
            $match: {
                username: username?.toLowerCase()     //match username comming from db and the username comming from req.params
            }
        },
        // Find subscribers to the user's channel
        {
            $lookup: {
                from: "subscriptions",         //other collection // Subscription in db names is subscriptions
                localField: "_id",             //The _id field from the User collection
                foreignField: "channel",       // field in other collection  // The channel field from the subscriptions collection (which is linked to the user)
                as: "subscribers"              // The resulting array will be stored in this field (subscribers)
            }
        },
        // find a user subscribe whom ,count // Lookup channels that the user is subscribed to
        {
            $lookup: {
                from: "subscriptions",         //other collection // Subscription in db names is subscriptions
                localField: "_id",             //field in this collection // The _id field from the User collection
                foreignField: "subscriber",    // field in other collection  // The subscriber field from the subscriptions collection (which indicates users they are subscribed to)
                as: "subscribedTo"             // The resulting array will be stored in this field (subscribedTo)
            }
        },
        // Add additional calculated fields to the result
        {
            $addFields: {
                // Count the number of subscribers for the channel
                subscribersCount: {
                    $size: "$subscribers"    // Use the $size operator to get the size of the subscribers array
                },
                // Count how many channels this user is subscribed to
                channelsSubscribedToCount: {
                    $size: "$subscribedTo"   // Use the $size operator to get the size of the subscribedTo array
                },
                // Check if the current user is subscribed to this channel
                isSubscribed: {
                    $cond: {
                        // muze ye dekhna he ki aapke pass jo doc aaya hee(subscribers) usme mee hu ya nahi
                        // Use the $in operator to check if the current user's ID exists in the subscribers array
                        if: { $in: [req.user?._id, "$subscribers.subscriber"] },
                        then: true,                // If the user is subscribed, set this field to true
                        else: false                // Otherwise, set it to false
                    }
                }
            }
        },
        {
            // Project (select) the specific fields to include in the final result
            $project: {
                fullName: 1,                        // Include the fullName field
                username: 1,                        // Include the username field
                subscribersCount: 1,                // Include the calculated subscribersCount field 
                channelsSubscribedToCount: 1,       // Include the calculated channelsSubscribedToCount field
                isSubscribed: 1,                    // Include the isSubscribed field 
                coverImage: 1,                      // Include the coverImage field              
                email: 1,                           // Include the email field  
            }
        }

    ])
    // console.log(channel);
    // If no channel was found (the aggregation result is empty), throw a 404 (Not Found) error
    if(!channel?.length){
        throw new ApiError(404, "Channel Does Not Exists")
    }
   // If the channel is found, return the result with a 200 (OK) status
    return res
    .status(200)
    .json(
        new ApiResponse(200, channel[0], "User Channel Fetched Successfully") // Send the first result from the aggregation
    )
})




// Get watch history for the logged-in user
const getWatchHistory = asyncHandler(async (req, res) => {
    // Retrieve the user's ID from the request (assumed to be set by authentication middleware)
    const user = await User.aggregate([
        // Step 1: Match the user in the database using their ID
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id) // Convert req.user._id to ObjectId and match the user
            }
        },
         // Step 2: Lookup the user's watch history by referencing the videos they watched
        {
            $lookup: {
                from: "videos",                  // Lookup videos from the 'videos' collection
                localField: "watchHistory",      // The field in the User document that holds watched video IDs
                foreignField: "_id",             // The _id field in the 'videos' collection to match with User's watchHistory field
                as: "watchHistory",              // Store the matched video documents in a field called 'watchHistory' 
                
                //Further process the videos data with a pipeline
                pipeline: [
                    {
                        // Step 3: Lookup the owner (uploader) of each video
                        $lookup: {
                            from: "users",         // Join with the 'users' collection to get the video owner's details
                            localField: "owner",   // The 'owner' field in the video document holds the owner's user ID
                            foreignField: "_id",   // Match with the _id field in the 'users' collection
                            as: "owner",           // Store the matched owner details in a field called 'owner'
                            // Optional: Further process the videos data with a pipeline
                            pipeline: [
                                 // Step 4: Project only specific fields from the owner (fullName, username, avatar)
                                {
                                    $project: {
                                        fullName: 1,
                                        username: 1,
                                        avatar: 1,     // Include only these fields from the owner document
                                    }
                                },
                                 // Step 5: Add an 'owner' field that takes the first result from the 'owner' array
                                {
                                    $addFields: {
                                        owner: {
                                            $first: "$owner" // Get the first (and typically only) element from the 'owner' array
                                        }
                                    }
                                }
                            ]
                        }
                    }
                ]
            }
        }
    ])
    // Return the fetched watch history in the response
    return res
        .status(200)
        .json(
            new ApiResponse(200, user[0].watchHistory, "Watch History Fetched Successfully") // Return the watchHistory data from the user
        )
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
    getUserChannelProfile,
    getWatchHistory
}; 