import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("NegotiationFactoryModule", (m) => {
  const factory = m.contract("NegotiationFactory");
  return { factory };
});
