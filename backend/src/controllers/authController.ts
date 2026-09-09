import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { error } from 'node:console';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const SECRET_KEY = process.env.JWT_SECRET; 

export const login = async (req: Request, res: Response): Promise<void> => {
  console.log("API CALLED");
  try {
    const {tenantId,username , password} = req.body;
    
    // validation 
    if(!tenantId || !username || !password){
      res.status(400).json({error: "Please provide tenant, username and password"});
      return;
    }
    
    const tenant = await prisma.tenant.findUnique({
      where:{subdomain:tenantId}
    })
    if(!tenant || tenant.status !== 'active'){
      res.status(400).json({error:"Invalid Tenant orInactive Tenant"})
      return;
    }
    // check for user
    const user = await prisma.user.findUnique({
      where: 
      {tenantId_username:{tenantId:tenant.id,username:username}}

    })
    // if no user
    if(!user || user.status !== 'active'){
      res.status(401).json({error:"Invalid Credentials"});
      return;
    }
    //compare password
    const isMatch = await bcrypt.compare(password,user.passwordHash);
    if(!isMatch){
      res.status(401).json({error: "Invalid Credentials"})
      return;
    }
   
    const token = jwt.sign({
      userId : user.id,
      tenantId : tenant.id,
      role : user.role,
      fullName : user.fullName,
      companyName : tenant.companyName,
      
    },SECRET_KEY || 'supersecret',{
      expiresIn: '1h'
    })

    // Remove password hash before sending user data
    const { passwordHash, ...safeUser } = user;

    res.json({
      "success":true,
      "message":"Login Successful",
      token : token,
      user : safeUser
    })
    return;
    
  } catch (error) {
    console.error('Login failed:', error);
    res.status(500).json({ error: 'Internal server error during login' });
    return;
  }
}