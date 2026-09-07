import { supabase } from './supabase'
import { waiver, WaiverTable } from '../types'
import sharp from 'sharp'
import crypto from 'crypto'

const table = process.env.DB_TABLE!
const bucket = process.env.SUPABASE_BUCKET!


function calcRisk(body: any) {

    const conditions = [body.alcoholism, body.claustrophobia, body.dizzines, body.ear_infection,
    body.epilepsy, body.peptic_ulcers, body.respiratory_problems, body.neck_injure,
    body.back_problems, body.drug_use, body.depression, body.heart_problems, body.recent_operation,
    body.headaches, body.overweight]

    let count = 0

    for (let i = 0; i < conditions.length; i++) {
        if (conditions[i] === true) {
            count++
        }
    }

    if (count <= 1) return 'Bajo'
    if (count === 2) return 'Medio'
    return 'Alto'
}





async function pngToWebP(dataUrl: string): Promise<Buffer> {

    const base64 = dataUrl.replace("data:image/png;base64,", "")
    const pngBuffer = Buffer.from(base64, "base64")

    const webpBuffer = await sharp(pngBuffer)
        .webp({ quality: 60 })
        .toBuffer()

    return webpBuffer
}


async function uploadsign(dataUrl: string): Promise<string> {

    if (!dataUrl.startsWith('data:image/png;base64,')) {
        throw new Error('Firma inválida')
    }

    const buffer = await pngToWebP(dataUrl)

    const name = `${bucket}/${new Date().toISOString().slice(0, 10)}_${crypto.randomUUID()}.webp`

    const { error } = await supabase.storage
        .from(bucket)
        .upload(name, buffer, {
            contentType: "image/webp",
            upsert: false
        })

    if (error) throw new Error(`Error subiendo firma: ${error.message}`)

    return name
}


export async function getSignatureUrl(filePath: string, expiresIn = 3600): Promise<string> {
    const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(filePath, expiresIn)

    if (error || !data?.signedUrl) throw new Error('No se pudo generar URL de firma')
    return data.signedUrl
}












/** Returns list with basic waiver fields */
export async function getWaivers(): Promise<WaiverTable[]> {

    // Include email if sending mail
    const { data } = await supabase.from(table!).select('id, name, legal_guardian, tour_date, created_at, risk_level').order('id', { ascending: false })
    return data as WaiverTable[]
}


/** Returns all fields from a specific waiver */
export async function getwaiverById(id: number): Promise<waiver> {

    const { data } = await supabase.from(table!).select('*').eq('id', id).maybeSingle()
    return data as waiver
}


/** Insert into DB and return result. Sends confirmation email. */
export async function addWaiver(body: any): Promise<waiver> {

    const signature_url = await uploadsign(body.signature)

    const risk_level = calcRisk(body)

    // Include email: body.email if saving email
    const insert = {
        name: body.name, legal_guardian: body.legal_guardian, tour_date: body.tour_date,
        alcoholism: !!body.alcoholism, claustrophobia: !!body.claustrophobia, dizzines: !!body.dizzines,
        ear_infection: !!body.ear_infection, epilepsy: !!body.epilepsy, peptic_ulcers: !!body.peptic_ulcers,
        respiratory_problems: !!body.respiratory_problems, neck_injure: !!body.neck_injure, back_problems: !!body.back_problems,
        drug_use: !!body.drug_use, depression: !!body.depression, heart_problems: !!body.heart_problems, recent_operation: !!body.recent_operation,
        headaches: !!body.headaches, overweight: !!body.overweight,
        other_condition: body.other_condition, pregnancy: Number(body.pregnancy), medications: body.medications, date_medications: body.date_medications,
        date_examination: body.date_examination, date_xray: body.date_xray, other_areas: body.other_areas, signature_url, risk_level
    }

    delete (insert as any).signature
    const { data } = await supabase.from(table!).insert([insert]).select().single()

    /** Email sent in the background, no waiting */
    //sendEmail(data as waiver)
    return data as waiver
}