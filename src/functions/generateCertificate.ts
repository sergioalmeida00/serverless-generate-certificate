import * as dotenv from 'dotenv' 
dotenv.config()
import { APIGatewayProxyHandler } from "aws-lambda"
import { document } from "../utils/dynamodbClient"
import { join } from "path"
import { readFileSync } from "fs"
import {compile} from "handlebars"
import dayjs from "dayjs"
import chromium from 'chrome-aws-lambda'
import { S3 } from 'aws-sdk'

interface ICreateCertificate{
  id:string,
  name:string,
  grade:string
}

interface ITemplate{
  id:string,
  name:string,
  grade:string,
  medal:string,
  date:string
}

const compileTemplate = async ({id,name,grade,date,medal}:ITemplate) =>{
  const filePath = join(process.cwd(), "src","templates","certificate.hbs")

  const html = readFileSync(filePath,'utf8')

  return compile(html)({id,name,grade,date,medal})
}

export const handler: APIGatewayProxyHandler = async (event) =>{
    const {id,name,grade} = JSON.parse(event.body) as ICreateCertificate

    const response = await document.query({
      TableName:"users_certificate",
      KeyConditionExpression:'id = :id',
      ExpressionAttributeValues:{
        ':id': id
      }
    }).promise()
    const userAlreadyExists = response.Items[0]

    if(!userAlreadyExists){
      await document.put({
        TableName:"users_certificate",
        Item:{
          id,
          name,
          grade
        }
      }).promise()  
    }

    const medalPath = join(process.cwd(), "src","templates","selo.png")
    const medal = readFileSync(medalPath,'base64')

    const data:ITemplate = {
      id,
      name,
      grade,
      medal,
      date: dayjs().format('DD/MM/YYYY')
    }

    const content = await compileTemplate(data)

    const browser = await chromium.puppeteer.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath,
    })

    const page = await browser.newPage();
    await page.setContent(content)

    const pdf = await page.pdf({
      format: "a4",
      landscape:true,
      printBackground:true,
      preferCSSPageSize:true,
      path: process.env.IS_OFFLINE ? `./certificate-${name.trim()}.pdf`: null,
    })

    await browser.close()

    const s3 = new S3()
    console.log(process.env.BUCKET_NAME)
    s3.putObject({
      Bucket:process.env.BUCKET_NAME,
      Key:`${id}.pdf`,
      ACL:process.env.ACL,
      Body:pdf,
      ContentType:'application/pdf'
    }).promise()

    return {
      statusCode:201,
      body: JSON.stringify({
        message:"Certificado Criado com Sucesso",
        url:`https://node-certificate.s3.amazonaws.com/${id}.pdf`
      })
    }
}