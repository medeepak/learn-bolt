Express Learning Platform (MVP, B2C) - PRD

1. Product Overview
Product Name (Working)
Express Learning Platform
One-line Description
A just-in-time learning product that explains practical topics in small, visual, example-driven chapters so users can gain functional understanding quickly.
Core Promise
Help users move from confusion to confidence in 15–25 minutes, especially under time pressure.

2. Problem Statement
People often need to understand unfamiliar concepts urgently:
Before a meeting


Before starting a new task


Before an exam or trade


Before making a decision


Existing solutions fail in these moments:
Courses and books take too long


Blogs and videos are scattered


AI chat tools are unstructured and require good prompting


Users don’t know what to focus on or skip


The real problem is lack of clear mental models when time is limited.

3. Goals and Non-Goals
Goals (MVP)
Deliver clear, structured understanding fast


Enable completion in one sitting


Reduce cognitive load with visuals and examples


Support Indian languages and context


Validate willingness to pay (pay-per-use)


Non-Goals (MVP)
No mastery or certification


No daily learning habits or streaks


No social or community features


No native mobile apps


No B2B admin or SSO


No long-term spaced repetition systems



4. Target Users (ICP)
Primary
Time-crunched professionals


PMs, consultants, junior employees


People ramping up on new domains


Secondary
Students with near-term exams


Small business owners


Individual traders/investors


Common traits:
Urgent learning need


Wants clarity, not depth


Often uncomfortable asking “basic” questions



5. User Journeys (High Level)
User lands on home page


User enters topic + context


System generates learning plan


User reads mini chapters


User completes scenario checks


User saves and revisits plan


User pays for additional plans when needed



6. Information Architecture
Pages:
Landing / Home (ChatGPT-like)


Login / Signup


Checkout / Credits


Library


Learning Plan


Account / Settings


Error & Empty States



7. Workflow Details & Requirements

7.1 Landing Page (ChatGPT-Like)
Purpose
Primary entry point for creating learning plans.
Layout
Minimal, centered input


Calm, clean UI


Mobile-first


Components
Top bar:


Logo


Credits / free plans left


Library link (if logged in)


Login/Profile menu


Main input box:


Placeholder examples:


“Restaurant cash management”


“F&O puts vs calls”


“Microservices for PMs”


Context selectors (always visible):


Urgency: In 2 hours / Today / This week


Level: Beginner / Intermediate / Advanced


Language: English + Indian languages


Document upload (optional):


PDF/DOCX only


Max 10MB


Drag-and-drop + file picker


CTA:


“Create learning plan”


First-Time Guidance
Example prompts shown below input


Helper text under selectors


Tooltip: “Choose Beginner if unsure”



7.2 Authentication (Login Flow)
Methods
Email + OTP (required)


Google sign-in (optional)


Login Required For
Saving to library


Document upload


Follow-up questions


PDF export


Viewing library


Purchasing credits


Rules
First learning plan can be generated without login


Progress stored locally until login


On login, progress syncs to account


Error States
Wrong OTP


Expired OTP


Network failure


Retry logic required



7.3 Payment & Credits
Model
Pay-per-use credits.
Free Tier
2 learning plans/month


English only


No document upload


No follow-up questions


No PDF export


Paid Credits
₹150 → 1 plan


₹350 → 3 plans


₹650 → 7 plans


Credits never expire


Credit Consumption
Deduct credit only after successful plan generation


If generation fails → no deduction


Payment Flow
Razorpay checkout


UPI, cards, wallets


Idempotent callbacks


Paywall Triggers
No credits remaining


Attempt to upload documents


Attempt follow-up questions


Attempt PDF export



7.4 Learning Plan Generation
Inputs
Topic (required)


Urgency


Level


Language


Optional uploaded documents


Validation Rules
If topic is too broad:


Prompt user to narrow


If confidence is low:


Warn user


Suggest document upload


Output
6–12 mini chapters


Ordered by real-world flow


Depth adjusted by urgency + level



7.5 Learning Page (Core Experience)
Layout
Desktop:


Left sidebar: chapter outline + progress


Main content: chapter cards


Mobile:


Single scroll


Sticky progress bar


Outline drawer


Chapter Structure (Mandatory)
Each chapter must contain:
Title


Short explanation (5–10 lines)


Clear example (required)


Visual aid (required when useful)


Key takeaway (1 line)


“Mark complete” checkbox


Visual Rules
Less text, more visuals


Visuals occupy 35–50% of viewport


Allowed visuals:


Flow diagrams


Tables


Timelines


Checklists


Decision trees


Time Display
Estimated time per chapter


Total estimated time upfront



7.6 Scenario-Based Verification
Purpose
Check practical understanding, not memorization.
Format
2–4 scenarios per plan


Open-ended responses


“Show guidance” option


Completion Rule
Plan marked “Completed” when:


All chapters marked complete


Scenario section opened



7.7 Follow-Up Questions
Behavior
User asks question in plain language


System responds concisely


Option: “Add as new chapter”


Limits
Free users: disabled


Paid users: max 3 questions per plan



7.8 Library
Features
View all plans


Filter: In progress / Completed


Search by topic


Sort by recent


Library Card
Topic


Level, urgency, language


Progress


Buttons:


Open


Quick refresh


Export PDF (paid)


Delete



7.9 Quick Refresh Mode
Shows:


Chapter titles


Key takeaways only


Estimated refresh time (e.g., 5 minutes)



7.10 PDF Export
Includes:


Chapters


Examples


Visuals


Scenario questions


Paid only



7.11 Document Upload Lifecycle
User can remove files before generation


Files linked to plan


Deleting plan deletes file reference


Files auto-deleted after configurable time



7.12 Regeneration & Versioning
Regeneration creates a new plan


Old plan becomes read-only


Progress does not carry over


No comparison UI in MVP



8. Language Handling Rules
Technical terms remain in English


Explanations translated


If translation confidence is low:


Show English summary below


Language switch regenerates plan



9. Error & Recovery States
Image load failure → text fallback


Generation timeout → retry


Follow-up failure → retry message


Offline mode:


Read cached content


No generation or Q&A



10. Abuse & Cost Controls
Max plans/day per user


Max document size & pages


Rate-limit regenerations


Server-side enforcement



11. Accessibility
Minimum font size: 16px


High contrast text


Images accompanied by text


Keyboard navigation supported



12. Metrics (MVP)
Activation
First plan created


Time to first value


Engagement
Completion rate


Avg time vs estimate


Monetization
Credit purchase conversion


Avg credits/user


Quality
Confidence self-rating


“Better than ChatGPT?” response



13. MVP Timeline
Weeks 1–2: Manual validation


Weeks 3–4: Design + architecture


Weeks 5–8: Build MVP


Weeks 9–12: Private beta (100 users)



14. PRD Summary
This MVP:
Solves urgent learning problems


Breaks content into small, visual, example-driven chapters


Prioritizes clarity over depth


Supports Indian context and languages


Validates real willingness to pay before scaling


If users finish, feel confident, and pay — the product earns the right to grow.


# UI / UX Fundamentals (Non-Negotiable)

Design this product assuming:

The user is slightly stressed

The user has limited time

The user may feel stupid asking basic questions

The UI must calm them, not impress them

1. Clarity Beats Cleverness

Every screen must answer one primary question.

Remove anything that does not directly help learning or progress.

Avoid hidden controls, fancy gestures, or clever micro-interactions.

Labels must be literal and obvious. No jargon.

Bad:

“Initiate Learning Flow”
Good:

“Create learning plan”

2. Visual Hierarchy Is the Product

The eye should know where to look within 1 second.

Use size and spacing first, color second.

Headings must clearly dominate body text.

Examples and visuals must stand out more than explanations.

Hierarchy order:

Chapter title

Example / visual

Key takeaway

Explanation text

3. Less Text, More Understanding

Never show long paragraphs.

Break text into short lines.

One idea per paragraph.

Use whitespace generously.

Rules:

Max 5–10 lines per explanation.

If text feels long, replace with a visual or example.

If something needs more explanation, split it into another chapter.

4. Large Touch Targets, Calm Interactions

Buttons must be easy to tap on mobile.

Minimum touch target: 44px.

Avoid dense layouts.

No accidental clicks.

Primary actions should always be obvious:

“Create learning plan”

“Mark complete”

“Next”

5. Make Progress Feel Reassuring, Not Demanding

Progress indicators should reduce anxiety.

Avoid language that feels evaluative or judgmental.

Good:

“3 of 8 chapters done”

“You’re on track”
Bad:

“Incomplete”

“You failed this”

Completion should feel like relief, not achievement pressure.

6. Reduce Cognitive Load Everywhere

Never ask the user to remember things.

Keep context visible:

Topic

Time remaining

Progress

Avoid modal overload.

If a decision is not critical, pick a sensible default.

7. Friendly, Adult Tone (Not Academic, Not Childish)

Avoid academic language (“objectives”, “modules”, “assessment”).

Avoid playful cartoonish UI or gamification.

Use a calm, helpful voice.

Tone examples:

“Here’s what matters”

“You can skip this if short on time”

“Most people stop here and are fine”

8. Design for Confidence, Not Mastery

The UI should signal:
“You now know enough to proceed.”

Avoid:

Scores

Percent grades

Leaderboards

Streaks

Badges

End-of-plan moment should say:

“You’re good to go.”

9. Predictability Over Surprise

Buttons should behave consistently.

Navigation should never change position unexpectedly.

Same actions should look the same everywhere.

This is a tool, not an experience playground.

10. Mobile Is a First-Class Citizen

Design mobile layouts intentionally, not as a shrink-down.

One column.

Large visuals.

Sticky progress indicator.

Bottom-aligned primary actions where appropriate.

Assume learning happens:

During commute

During breaks

Between meetings

11. Errors Should Feel Gentle and Recoverable

Never blame the user.

Always offer a next step.

Bad:

“Error occurred.”
Good:

“We couldn’t generate this yet. Try again or narrow the topic.”

12. The UI Should Never Look Like “Ed-Tech”

Avoid:

Loud colors

Over-illustration

Gamified metaphors

Classroom vibes

This should feel like:

A smart notebook

A calm assistant

A reliable reference

# AI

Use Open AI for AI based generation of content