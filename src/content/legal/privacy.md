# Privacy Policy

Version 1 — effective on signup.

## 1. What we collect

- **Account data**: name, email, password hash (handled by Supabase Auth).
- **Profile intake**: address, date of birth, sex, height, weight,
  occupation, training background, goals.
- **Medical data**: conditions, medications, allergies, injuries, emergency
  contact. Stored AES-256-GCM encrypted at rest. The decryption key lives
  in a separate environment and is never written to the database.
- **Activity data**: workout sessions, meal logs, habit checks, weekly
  check-ins, photos, conversations with the AI assistant.
- **Billing data**: handled by Stripe. We retain Stripe customer and
  subscription IDs only. Card numbers never reach our servers.

## 2. How we use it

To deliver coaching, generate AI outputs personalized to your goals, send
operational email, process payment, and improve the product.

## 3. Who can see it

- You.
- The PKFIT coach / owner (operating the service).
- Service providers who must process the data to deliver the product:
  Supabase (storage, auth), Anthropic (Claude AI), Google (Gemini AI),
  fal.ai (image and video generation), Stripe (billing), Netlify
  (hosting), and email senders. Each is bound by their own terms.
- Law enforcement, when compelled by valid legal process.

## 4. AI processing

When you interact with the AI assistant or generators, your prompts and
the relevant context (training history, intake, goals) are sent to the AI
provider for inference. We do not allow providers to train on your data
when an opt-out is available.

## 5. Storage and retention

Data is stored in Supabase, which uses AWS region us-east-1 by default.
You can export your data at any time from Settings, or delete your
account, which removes profile rows and orphans Stripe records to a
canceled state.

## 6. Security

TLS in transit, AES-256-GCM for medical fields at rest, role-based
row-level security on every table. We do not represent that this
constitutes HIPAA compliance. See the Coaching Agreement: PKFIT does not
provide medical care.

## 7. Children

Service is for users 18 and older. We do not knowingly collect data from
children.

## 8. Your rights

You may request access, correction, export, or deletion of your data by
emailing privacy@pkfit.app or using the in-app controls under Settings.

## 9. Updates

Material changes to this policy will be announced in the app and require a
new consent acknowledgment.

## 10. Contact

privacy@pkfit.app
