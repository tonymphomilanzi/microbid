api/listings/index.js
src/services/listings.service.js
api/listings/[id].js
UsernameSetup.jsx (username availability + suggestions + status UI)
MultiImageUpload.jsx (6-image gallery uploader)
Updated Navbar.jsx (admin link + bell + no logout)
Updated ListingDetails.jsx gallery UI + updated ListingCard.jsx to show username + verified badge




ListingCard.jsx (username + verified badge)
CreateListingForm.jsx (multi-image gallery uploader, max 6)
ListingDetails.jsx (gallery viewer)



A UsernameSetupDialog.jsx you can open from dashboard to set username for existing users
ListingDetails seller block updated to show username + verified and never email


In AuthContext, ensure you export refreshMe
So after login/signup, navbar/dashboard can reflect username/admin role quickly.



8) Admin approval (later, still within existing admin function)
Next we’ll add to your admin catch-all:

GET /api/admin/upgrade-requests
PATCH /api/admin/upgrade-requests?id=... to approve/reject and update User.tier
Tell me when you’re ready and I’ll provide the exact code + an admin page.

If you paste your api/admin/[...path].js, I can insert the plans editor + upgrade requests endpoints directly without increasing serverless function count.