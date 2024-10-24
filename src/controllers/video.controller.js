import mongoose, { isValidObjectId } from "mongoose";
import { Video } from "../models/video.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary, deleteFromCloudinary } from "../utils/cloudinary.js";


// get All Videos
// This portion of code handles the search functionality. If the user provides a search query as part of the request, it performs a text search in both the title and description fields of the videos in the database.
const getAllVideos = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, query, sortBy = "createdAt", sortType = "desc" } = req.query;
    // page: The current page of data (defaults to 1 if not provided).
    // limit: The number of items per page (defaults to 10).
    // query: A search term for filtering videos based on title or description (optional).
    // sortBy: The field to sort the results by (defaults to "createdAt").
    // sortType: The order to sort the results ("asc" for ascending or "desc" for descending).

    const videos = await Video.aggregate([
        // This checks if a query parameter exists. If it does, the $match stage is used to find videos where the title or description matches the search text.
        ...(query ? [
            {
                // $match: This is a MongoDB aggregation stage used to filter documents (videos) that meet certain criteria
                $match: {
                    // $or: This ensures that either the title or the description matches the search query. It checks both fields and returns documents that match at least one condition.
                    $or: [
                        {
                            // $regex: This is a MongoDB operator for performing pattern matching,It checks if the title or description contains the text provided in query
                            // $options: "i": "i" stands for case-insensitive. It ensures that the search will match regardless of whether the text is in uppercase or lowercase.
                            title: { $regex: query, $options: "i" },
                        }, {
                            description: { $regex: query, $options: "i" },
                        }
                    ]
                }
            }
        ] : []), //If query does not exist, the : part evaluates to false, and it returns an empty array ([]), meaning no filtering based on title or description will happen
        {
            // Filters the videos to include only those that are marked as isPublished: true. This ensures that only published videos are returned.
            $match: { isPublished: true },
        }, {
            // This is a lookup stage that joins the Video collection with the users collection to get information about the video's owner (user).
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",
                pipeline: [  //pipeline: Defines the fields to include from the users collection (avatar, username, fullName).
                    {
                        $project: {
                            avatar: 1,
                            username: 1,
                            fullName: 1,
                        },
                    }
                ]
            }
        }, {
            // $addFields: This MongoDB aggregation operator adds a new field or modifies an existing one in the document. 
            // Here, it’s being used to update the owner field.
            $addFields: {
                owner: {
                    // $first: This operator takes the first element from an array
                    // This means we want to extract the first user from the owner array and assign it back to the owner field.
                    $first: "$owner"
                }
            }
        }, {
            // Select Specific Fields to Return:
            // $project: Specifies the fields to include in the response
            $project: {
                _id: 1,
                owner: 1,
                videoFile: 1,
                title: 1,
                thubnail: 1,
                description: 1,
                duration: 1,
                views: 1,
                isPublished: 1,
                createdAt: 1,
            },
        }, {
            $sort: {
                [sortBy]: sortType === "asc" ? 1 : -1
            }
        }, {
            // $skip skips a number of videos so that only the ones relevant to the current page are returned.
            // The calculation (page - 1) * limit ensures that the correct number of documents are skipped for each page.
            // On page 1, it skips 0 documents.
            // On page 2, it skips the first 10 documents (assuming limit is 10).
            // On page 3, it skips the first 20 documents, and so on.
            $skip: (page - 1) * limit,
        }, {
            // $limit: This is a MongoDB aggregation stage that restricts the number of documents returned. It tells MongoDB to stop processing the pipeline after reaching the specified number of results.
            //parseInt(limit): This converts the limit value (which is a string, since query parameters are passed as strings in HTTP requests) into an integer. parseInt() is necessary because MongoDB requires a numeric value for the limit.
            $limit: parseInt(limit)
        }
    ]);

    if (videos.length == 0) {
        return res.status(404).json(new ApiResponse(404, [], "No videos found"));
    }
    return res
        .status(200)
        .json(new ApiResponse(200,
            videos,
            "Videos Fetched Successfully"
        ))
});


// Controller function to get a particular user's videos
const getUserVideos = asyncHandler(async (req, res) => {
    // extract the page, limit, sortType from req.query
    // extract userId from req.params
    // Validate the User ID: Ensure that the provided user ID is valid.
    // Fetch Videos: Query the database for videos associated with the user ID
    // Return a proper response if no videos are found.
    // Return the list of videos in the response.

    const {
        page = 1,   // Default to the first page if not provided
        limit = 10, // Default to 10 items per page if not provided
        sortType = "desc"  // Default sorting order is descending if not specified
    } = req.query;

    // Extract the userId from the request parameters
    const { userId } = req.params;

    // Validate the User ID: Check if the provided user ID is a valid MongoDB ObjectId
    if (!mongoose.isValidObjectId(userId)) {
        throw new ApiError(400, "Invalid UserId");
    }

    // Fetch Videos: Query the database for videos associated with the user ID.
    const videos = await Video.aggregate([
        {
             // Match userId to find videos owned by the specified user
            $match: {
                owner: new mongoose.Types.ObjectId(userId) // Convert userId to ObjectId for matching
            }
        },
        {     
            // Filter only published videos
            $match: { isPublished: true }
        },
        { 
            // Sort videos based on their creation date
            $sort: {
                createdAt: sortType === "asc" ? 1 : -1,
            }
        },
        {
            // Skip a number of records for pagination
            $skip: (page - 1) * limit
        },
        { 
            // Limit the number of results returned based on the limit provided
            $limit: parseInt(limit)
        },
        {
            // Lookup user information from the 'users' collection to get owner details
            $lookup: {
                from: "users", // Join with the users collection
                localField: "owner",   // Match with the owner's ID in the videos collection
                foreignField: "_id",  // Match against the user IDs in the users collection
                as: "owner", 
                pipeline: [
                    {  // Project only specific fields to return for the owner
                        $project: {
                            avatar: 1,
                            username: 1,
                            fullName: 1,
                        }
                    }
                ]
            }
        },
        { // Specify the fields to return in the final output
            $project: {
                _id: 1,
                owner: 1,
                videoFile: 1,
                thubnail: 1,
                createdAt: 1,
                description: 1,
                title: 1,
                duration:1,
                views: 1,
                isPublished: 1,
            }
        },
    ]);

    // If not Found
    if(!videos || videos.length === 0){
        throw new ApiError(404, "Error while Fetching Videos");
    }
    // Return the list of videos
    return res
        .status(200)
        .json(new ApiResponse(200, videos, "Videos Fetched Succcessfully"));
})


export { getAllVideos, getUserVideos };