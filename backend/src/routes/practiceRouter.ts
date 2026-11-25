
import {getMyPracticeData} from'../controllers/practiceController';
import { Router } from "express";

const router = Router();

//when is come get requwest connect to getPractiseDarouter.get("/getpractice", getMyPracticeData);ta 
router.get('/my-data',getMyPracticeData);




export default router;