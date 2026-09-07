/**
 * Rutas servicios de waivers
 * 
 * Endpoints:
 * - GET / : Lista de waivers
 * - GET /:id : detalles de waiver por id
 * - POST / : registra waiver
 * - GET /:id/pdf : descarga el PDF de waiver
 */

import { Router } from "express"
import { getWaivers, getwaiverById, addWaiver, getSignatureUrl } from "../services/waiverServices"
import { genPdf } from "../services/pdfService"
import { valAuth } from "../middleware/valAuth"

const router = Router()

/** List all waivers, protected for admin only */
router.get("/", valAuth, async (_req, res) => {

    try {
        const waivers = await getWaivers()
        return res.json(waivers)
    } catch (err: any) {
        return res.status(500).json({ error: 'Error en obtener waivers' })
    }
})

/** Get waiver details by ID, protected for admin only */
router.get("/:id", valAuth, async (req, res) => {

    const id = Number(req.params.id)

    try {
        const waiver = await getwaiverById(id)
        return res.json(waiver)
    } catch (err: any) {
        return res.status(500).json({ error: 'Error en obtener waiver' })
    }
})

/** Register a new waiver, public */
router.post("/", async (req, res) => {

    try {
        const waiver = await addWaiver(req.body)
        return res.status(201).json(waiver)
    } catch (err: any) {
        return res.status(500).json({ error: 'Error en registrar waiver' })
    }
})

/** Returns PDF waiver by ID, protected for admin only */
router.get("/:id/pdf", valAuth, async (req, res) => {

    const id = Number(req.params.id)

    try {
        const waiver = await getwaiverById(id)

        const signedUrl = await getSignatureUrl(waiver.signature_url)
        const waiverSigned = { ...waiver, signature_url: signedUrl }

        const pdf = await genPdf(waiverSigned)
        const name = String(waiver.name).replace(/[^\w\- ]+/g, "").trim()

        res.set({
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="Waiver-${name}.pdf"`,
            "Cache-Control": "no-store",
        })

        return res.send(pdf)
    } catch (err: any) {
        return res.status(500).json({ error: "Error al generar PDF" })
    }
})

export default router