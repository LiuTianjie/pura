export function makeDeviceId(agentId: string, serial: string) {
  return `${encodeURIComponent(agentId)}.${Buffer.from(serial, "utf8").toString("base64url")}`;
}

export function parseDeviceId(deviceId: string) {
  const [encodedAgentId, encodedSerial] = deviceId.split(".", 2);
  if (!encodedAgentId || !encodedSerial) {
    throw new Error("Invalid device id");
  }

  return {
    agentId: decodeURIComponent(encodedAgentId),
    serial: Buffer.from(encodedSerial, "base64url").toString("utf8")
  };
}
