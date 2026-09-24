import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { SectionDivider } from "@/components/section-divider";
import { auth } from "@/lib/auth";
import {
  HeroSection,
  AboutSection,
  PartnershipSection,
  InspectorTrainingSection,
  TeacherTrainingSection,
  AiProgramSection,
  SoftwareSection,
  DeploymentSection,
  VisionSection,
  ExpertiseSection,
  CollaborationsIntroSection,
  InukaCtaSection,
} from "@/components/inuka-tech/sections";
import { JrsCollaborationSection } from "@/components/inuka-tech/jrs-section";

export const metadata = {
  title: { absolute: "INUKA TECH — Partenaire technologique de l'IPP Nord-Kivu 1" },
  description:
    "INUKA TECH conçoit, déploie et accompagne des solutions numériques pour les institutions, les écoles et les organisations éducatives du Nord-Kivu.",
  alternates: { canonical: "/inuka-tech" },
};

export default async function InukaTechPage() {
  const session = await auth();
  const isConnected = Boolean(session?.user);

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <SiteHeader isConnected={isConnected} />

      <HeroSection />
      <AboutSection />
      <PartnershipSection />
      <InspectorTrainingSection />
      <TeacherTrainingSection />
      <AiProgramSection />
      <SoftwareSection />
      <SectionDivider />
      <DeploymentSection />
      <VisionSection />
      <ExpertiseSection />
      <SectionDivider />
      <CollaborationsIntroSection />
      <JrsCollaborationSection />
      <InukaCtaSection />

      <SiteFooter />
    </div>
  );
}
