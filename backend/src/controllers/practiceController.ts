import { Request , Response } from "express";
import { Prisma } from "@prisma/client";
import prisma from "../config/prisma";

export const  getMyPracticeData = async (req:Request , res:Response) : Promise<void> =>{
    try {
    const practicedata = await prisma.mF_G_ActivityCode.findMany({
        take : 20,
        select:{
            id:true,
            code:true,
            description : true,
            unit:true,
        },
        orderBy:{
            code:'asc',
        },
        
    })
    res.json({
        success:true,
        count:practicedata.length,
        items:practicedata,
    });   

    } catch (error) {
       console.log('Error feaching Data:',error);
       res.status(500).json({
        error:'data base eken daththa ganna be case case'
       }) 
    }
}