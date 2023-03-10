
import * as dotenv from 'dotenv' 
import { APIGatewayProxyHandler } from "aws-lambda"
import { document } from "../utils/dynamodbClient"
dotenv.config()

interface IUserCertificate{
  id:string, 
  name:string,
  created_at:string,
  grade:string
}

export const handler: APIGatewayProxyHandler = async (event) =>{
  const {id} = event.pathParameters

  const response = await document.query({
    TableName:"users_certificate",
    KeyConditionExpression:"id = :id",
    ExpressionAttributeValues:{
      ':id':id
    }
  }).promise()

  const userCertificate = response.Items[0] as IUserCertificate

  if(userCertificate){
    return {
      statusCode:200,
      body:JSON.stringify({
        message:"Valid Certificate..",
        name:userCertificate.name,
        grade:userCertificate.grade,
        url:`${process.env.AWS_S3_BUCKET_URL}${id}.pdf`
      })
    }
  }

  return{
    statusCode:400,
    body:JSON.stringify({
      message:"Invalid Certificate!"
    })
  }

}