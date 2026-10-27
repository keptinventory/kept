---
title: Reminders and notifications
description: "What Kept reminds you of, how the notification centre works, channel setup for ntfy, Telegram and Apprise, and per-location settings."
---

Kept reminds you of schedules due, warranties running out and registration deadlines, documents
and things that expire, overdue loans, meters not read lately, low stock, members joining and
leaving, and AI spending caps. Home's **Needs you** shows what's due or overdue; the bell opens
the notification centre, where **Complete**, **Snooze**, **Renew** and **Mark returned** act in
place.

This page covers what reaches you, how to set up channels, and per-location settings. For push
notifications on a phone, see [Kept on your phone](/users/phone-app/#notifications).

## What reaches you

Home's **Needs you** shows six counts, always in the same place: **Overdue**, **Due**,
**Expiring**, **Lent out**, **Uncertain** and **Low stock**. A zero is greyed out, not hidden.
**Borrowed in** and **Long unseen** appear when they have something. On a computer each one names
its most urgent item. Tap one to open that list, already filtered.

The notification centre (the bell) lists everything that's due or overdue, grouped by kind. From
there you can **Complete**, **Snooze**, **Renew** or **Mark returned** without leaving the page.

## Settings

**Settings → Me → Notifications** chooses what reaches you and how:

- **Daily digest**: a single daily summary instead of individual notifications.
- **Quiet hours**: no notifications during the hours you set. Nothing is pushed or emailed in
  them; what comes due waits until they end and is sent then.
- **Calendar feed**: a private link for your calendar app, showing due dates.

Push on a phone is covered in [Kept on your phone](/users/phone-app/#notifications).

## The notification table

**What reaches you** is one table. Rows are the kinds, grouped:

- **Due dates**: schedules, warranties, registration deadlines, documents, things that expire,
  meters not read lately.
- **Lending**: overdue loans.
- **Stock**: low stock.
- **People**: members joining and leaving.
- **AI**: spending caps and the monthly summary.

Columns are your channels:

- **In Kept**: the notification centre and Home's Needs you.
- **Email**: to your account's email address.
- **Push**: to your phone (where push is set up).
- **Webhook / ntfy / Telegram / Apprise**: once you've added one, a column appears for each kind.

Membership and AI notices only go to Kept and email. Turning **In Kept** off for a kind turns it
off everywhere: nothing else is sent for it. On a phone, each kind shows its channels as switches
underneath.

## Per-location settings

- **All locations** sets what you get everywhere, including locations you add later.
- **Pick a location** to change it there only. A dot marks what's set for that location alone.
- **Reset this location to all locations** clears those overrides.
- A kind whose module is off there shows as paused (its reminders wait until the module is back).
- Where you're a viewer you only get members joining and leaving.
- Where you're a member, Kept starts with only the loans you record: turn on what you want there.

## Setting up channels

### ntfy

Add your server (`https://ntfy.sh` or your own) and a topic that's hard to guess, plus an access
token if the topic needs one. Kept keeps all of these encrypted and never shows them again.
**Test** sends one now.

### Telegram

Make a bot with @BotFather, send it a message, then add its token and your chat ID. Kept keeps
all of these encrypted and never shows them again. **Test** sends one now.

### Apprise

When your server has Apprise, paste one or more Apprise URLs, like `discord://…`, to reach
Discord, Slack, Matrix, Signal and more. Kept keeps all of these encrypted and never shows them
again. **Test** sends one now.

## Lending reminders

**Lend** a thing (or part of a quantity) to a member or a contact, with a due date and condition
photos. Kept never messages the borrower; **Copy a reminder** gives you the text to send yourself.
A box goes with everything inside it, each thing on its own line. See
[Kits and hand-overs](/users/kits/).

## Related

- [Kept on your phone](/users/phone-app/) for push notifications and offline use.
- [Everyday use](/users/everyday-use/) for the wider picture.
- Vehicles and machines for meter readings and service schedules.
