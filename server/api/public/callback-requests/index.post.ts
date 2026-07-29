import { createCallbackRequestSchema } from "~~/shared/schemas/callbackRequests/createCallbackRequest";

export default defineEventHandler(async (event) => {
  const body = await validateBody(event, createCallbackRequestSchema);

  const callbackRequest = await prisma.callbackRequest.create({
    data: {
      name: body.name,
      phone: body.phone,
      consentAccepted: body.consentAccepted,
      sourcePath: body.sourcePath || null
    },
    select: {
      id: true,
      createdAt: true
    }
  });

  setResponseStatus(event, 201);

  return {
    success: true,
    callbackRequest
  };
});
