# Twilio Voice Setup

Store these values in Vercel environment variables. Do not commit real secrets.

```env
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_API_KEY_SID=
TWILIO_API_KEY_SECRET=
TWILIO_PHONE_NUMBER=+16784985097
TWILIO_TWIML_APP_SID=
NEXT_PUBLIC_APP_URL=https://your-production-domain.com
TWILIO_RECORD_CALLS=true
TWILIO_VALIDATE_WEBHOOKS=true
```

## TwiML App

In Twilio Console, open **Develop -> TwiML apps -> your app -> Voice**.

- Request URL: `https://your-production-domain.com/api/twilio/voice`
- HTTP method: `POST`

## Phone Number

In Twilio Console, open **Phone Numbers -> Manage -> Active numbers -> +16784985097 -> Voice Configuration**.

- Configure with: `Webhook`
- A call comes in: `https://your-production-domain.com/api/twilio/voice/inbound`
- HTTP method: `POST`

## Platform Behavior

- VA Desk call button registers a browser phone with Twilio Voice SDK.
- Floating global comms window includes click-to-call for the selected seller thread.
- Outbound browser calls use the TwiML App and dial the seller from the Meridian Twilio number.
- Inbound calls to the Meridian Twilio number ring the registered VA browser client.
- Call status events save to `meridian_communication_events` with `channel = "voice"`.
- Twilio records connected calls with dual channels and posts recording availability to `/api/twilio/voice/recording`.
- Recording callbacks save a separate communication event with `provider_event_type = "call-recording"` and a recording link in the event `media` array.
- Outbound calls use `/api/twilio/voice/disclosure` as the called-party pre-bridge disclosure hook.
- Inbound calls play a recording disclosure before ringing the browser client.
- Call buttons are blocked for TCPA litigators, federal/state DNC records, opted-out records, and records without a phone number.

## Recording Notes

The platform records calls by default. Set `TWILIO_RECORD_CALLS=false` only if recording needs to be temporarily disabled. Twilio recording URLs are references to Twilio-hosted audio; for long-term archival, download completed recordings into private storage and keep the Twilio Recording SID as the external reference.

## Production Best Practices

- Use HTTPS URLs only for Twilio webhooks.
- Keep `TWILIO_VALIDATE_WEBHOOKS=true` in production so incoming Twilio callbacks must pass `X-Twilio-Signature` validation.
- Keep Twilio access tokens short-lived. The current browser token lifetime is one hour.
- Because every call is recorded, approve the consent script, retention period, deletion process, and access policy before production calling.
- Use dual-channel recordings for two-party calls so each side is separated in one audio file.
- Store call status events and recording events separately, linked by Call SID / Recording SID and matched lead/deal IDs.
- Restrict recording links to authenticated platform users. If recordings need permanent storage, copy them to private storage and do not rely on public-facing links in UI.
- Do not collect payment card or other highly sensitive data on recorded calls unless the voice workflow is designed for PCI/compliance requirements.
