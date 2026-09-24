# Step 11 answers

1. The offline client may still have printed the ID. Handing the same string to another operator would collide legally. TTL only deletes the reservation row; the sequence number is already consumed, so the public string is never recycled.
2. No. A reservation is not a waste event. The lake and charging stay quiet until create or delivery writes EVENT and CURRENT.
3. Uniqueness comes from the same DynamoDB atomic counter (`SEQUENCE#MOVEMENT` / `SEQUENCE#DELIVERY`) and then `mintPublicId`. It is not random.
4. The server mints a new id. The reserved one stays reserved until it is claimed or it expires.
5. Hazardous deliveries: `deliveryId` equals the Movement ID, so the reserved delivery id is not consumed.
6. You get 40. The cap is 50 unused IDs in circulation per operator (the API key), not 50 per request and not per software client. Claimed or expired IDs free a slot.
