// require('dotenv').config({path: './env'})
import dotenv from 'dotenv';
import connectDB from "./db/index.js";
import app from './app.js';


dotenv.config({
    path: './.env'
})
connectDB()
.then(() =>{
    app.listen(process.env.PORT || 8000, ()=>{
        console.log(`Server is Running on PORT : ${process.env.PORT}`)
        app.on("error", console.error.bind(console, "MongoDB Cnnection Error"));
    });
})
.catch((error) =>{
    console.log("Mongo DB Connection Failed ! ", error);
});
















































/*
( async ()=>{
    try {
       await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
       app.on("error", (error)=>{
        console.log("ERROR : ", error);
        throw error
       })

       app.listen(process.env.PORT, () =>{
        console.log(`App is Listining on Port ${process.env.PORT}`);
       })

    } catch (error) {
        console.error("ERROR : ", error);
        throw err
    }
})()
*/