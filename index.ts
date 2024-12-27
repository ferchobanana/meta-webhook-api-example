// Este es el token de un usuario de sistema que obtenemos a través del administrador comercial
const GRAPH_API_TOKEN = "123456"

// Este es un token establecido por nosotros, puede ser cualquier cosa. Facebook nos lo solicita para validar el webhook a través de una
// solitud GET, que sirve unicamente como validación
const WEBHOOK_VERIFY_TOKEN = "123456"

// Extraemos el ID del número de nuestra cuenta de whatsapp business
function get_business_number_id_from_json(json: any) {
    return json.entry?.[0].changes?.[0].value?.metadata?.phone_number_id
}

// Extraemos el mensaje que envió el usuario
function get_message_from_json(json: any) {
    return json.entry?.[0]?.changes[0]?.value?.messages?.[0];
}

// Obtenemos el número del usuario que envio un mensaje con el formato correcto
// Nota: solo funciona para números mexicanos y solo es necesario durante el desarrollo. No usar en producción
function formatNumber(number: string) {
    // Obtener los primeros 2 números
    const primerosDos = number.slice(0, 2);
    // Obtener los últimos 10 números
    const ultimosDiez = number.slice(-10);
    // Unir ambas partes y retornar
    return primerosDos + ultimosDiez;
}

// Facebook solicita que el endpoint a donde se envian las notificaciones (el webhook), pueda recibir una
// solicitud de tipo get que valide la conexión del webhook a través de un token definido por nosotros
function facebook_verify_endpoint(c: any) {
    const mode = c.req.query("hub.mode");
    const token = c.req.query("hub.verify_token");
    const challenge = c.req.query("hub.challenge") as string;

    if (mode === "subscribe" && token === WEBHOOK_VERIFY_TOKEN) {
        return c.text(challenge, 200);
    } else {
        return c.text("Forbidden", 403);
    }
}


// De esta manera enviamos un mensaje de Whatsapp a través de la API cloud de Facebook
async function send_message(
    business_phone_number_id: string,
    GRAPH_API_TOKEN: string,
    to: string,
    message: string,
    message_to_respond_id: string | null
) {
    let res = await fetch(`https://graph.facebook.com/v20.0/${business_phone_number_id}/messages`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${GRAPH_API_TOKEN}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            messaging_product: "whatsapp",
            to: formatNumber(to),
            text: { body: message },
            context: { message_id: message_to_respond_id } // muestra el mensaje como una respuesta al mensaje que envio el usuario
        })
    })
}

// De esta manera marcamos que hemos visto un mensaje de Whatsapp a través de la API cloud de Facebook
async function mark_as_seen(
    business_phone_number_id: string,
    GRAPH_API_TOKEN: string,
    message_id: string
) {
    await fetch(`https://graph.facebook.com/v20.0/${business_phone_number_id}/messages`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${GRAPH_API_TOKEN}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            messaging_product: "whatsapp",
            status: "read",
            message_id: message_id,
        })
    })
}

// Esta es la función que maneja la notificación que recibimos en el endpoint del webhook
// Para recibir una notificacación lo hacemos a través del método POST.
// Cuando facebook nos envia una nueva notificación de mensaje de whatsapp, nos envia un JSON similar al que se encuentra en el archivo webhook.json de este repositorio
// El parametro (c) de la función, contiene los datos de la solicitud recibida por facebook
// Al final, debemos responder con un HTTP code 200, de lo contrario facebook intentará enviar la solicitud de la notificación, multiples veces
async function facebook_post_endpoint(c: any) {
    const json = await c.req.json()

    // Obtenemos el mensaje del JSON de la solicitud
    const message = get_message_from_json(json)

    if (message?.type == "text") {
        // Obtenemos el id del numero de telefono de nuestro negocio
        const business_phone_number_id = get_business_number_id_from_json(json)

        // Obtenemos el texto del mensaje que recibimos del usuario
        const message_text = message.text.body

        // El numero del usuario que envió mensaje
        const user_phone_number = message.from

        // Creamos el mensaje con nuestro Agente de IA
        // ==================
        // Aqui va la llamada al agente
        // ==================

        // Enviamos el mensaje de respuesta
        await send_message(
            business_phone_number_id,
            GRAPH_API_TOKEN,
            user_phone_number,
            "Mensaje generado por el Agente de IA",
            message.id
        )

        // Marcamos el mensaje come visto
        await mark_as_seen(
            business_phone_number_id,
            GRAPH_API_TOKEN,
            message.id
        )
    }

    return c.json({}, 200);
}