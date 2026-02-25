const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3'

interface CalendarEventPayload {
  title: string
  description?: string
  startDateTime: string
  endDateTime: string
  attendees?: string[]
  timeZone?: string
}

async function createEvent(accessToken: string, event: CalendarEventPayload) {
  const body = {
    summary: event.title,
    description: event.description || '',
    start: {
      dateTime: event.startDateTime,
      timeZone: event.timeZone || 'UTC',
    },
    end: {
      dateTime: event.endDateTime,
      timeZone: event.timeZone || 'UTC',
    },
    attendees: event.attendees?.filter(Boolean).map((email) => ({ email })) || [],
    conferenceData: {
      createRequest: {
        requestId: crypto.randomUUID(),
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    },
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'email', minutes: 30 },
        { method: 'popup', minutes: 10 },
      ],
    },
  }

  const res = await fetch(
    `${CALENDAR_API}/calendars/primary/events?sendUpdates=all&conferenceDataVersion=1`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  )

  if (!res.ok) {
    const err = await res.json()
    const message = err.error?.message || `Google Calendar API error: ${res.status}`
    console.error('Google Calendar API createEvent error:', JSON.stringify(err))
    throw new Error(message)
  }

  return res.json()
}

async function deleteEvent(accessToken: string, eventId: string) {
  const res = await fetch(
    `${CALENDAR_API}/calendars/primary/events/${encodeURIComponent(eventId)}?sendUpdates=all`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  )

  if (!res.ok && res.status !== 404 && res.status !== 410) {
    const err = await res.json()
    console.error('Google Calendar API deleteEvent error:', JSON.stringify(err))
    throw new Error(err.error?.message || `Google Calendar API error: ${res.status}`)
  }

  return { success: true }
}

async function listEvents(accessToken: string, timeMin: string, timeMax: string) {
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '50',
  })

  const res = await fetch(
    `${CALENDAR_API}/calendars/primary/events?${params}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  )

  if (!res.ok) {
    const err = await res.json()
    console.error('Google Calendar API listEvents error:', JSON.stringify(err))
    throw new Error(err.error?.message || `Google Calendar API error: ${res.status}`)
  }

  return res.json()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    let body: Record<string, unknown>
    try {
      body = await req.json()
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const { action, accessToken, eventData } = body as {
      action: string
      accessToken: string
      eventData: Record<string, unknown>
    }

    console.log(`google-calendar: action=${action}, hasToken=${Boolean(accessToken)}, tokenLength=${accessToken?.length ?? 0}`)

    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: 'Google access token is required. Please connect Google Calendar in Settings.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    let result: unknown

    switch (action) {
      case 'create_event':
        result = await createEvent(accessToken, eventData as unknown as CalendarEventPayload)
        break

      case 'delete_event':
        if (!eventData?.eventId) {
          return new Response(
            JSON.stringify({ error: 'eventId is required for delete_event' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          )
        }
        result = await deleteEvent(accessToken, eventData.eventId as string)
        break

      case 'list_events':
        if (!eventData?.timeMin || !eventData?.timeMax) {
          return new Response(
            JSON.stringify({ error: 'timeMin and timeMax are required for list_events' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          )
        }
        result = await listEvents(accessToken, eventData.timeMin as string, eventData.timeMax as string)
        break

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('google-calendar edge function error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
