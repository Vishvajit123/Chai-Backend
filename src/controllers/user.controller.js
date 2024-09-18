import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

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

    //find user from db 
    const user = await User.findOne({ $or: [{ username }, { email }] })

    if (!user) {
        throw new ApiError(404, "user does not exist");
    }

    const isPasswordValid = await user.isPasswordCorrect(password)

    if (!password) {
        throw new ApiError(401, "Password Incorrect");
    }

    // destructur access and refresh token from generateAccesTokenAndRefreshToken()
    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    // send cookies
    const options = {
        httpOnly: true,
        secure: true,
    }

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
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, {}, "User Logged Out"))
})




export { registerUser, loginUser, logoutUser }; 