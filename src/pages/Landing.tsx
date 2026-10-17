import { SiteFooter, SiteNav } from "../components/SiteNav";
import { RukoIntro } from "../components/brand/RukoLogo";
import { DemoExperience } from "../components/demo/DemoExperience";

export default function Landing() {
  return (
    <>
      <SiteNav />
      <main id="main" className="pt-28">
        <div className="container-x">
          <RukoIntro className="mx-auto w-[min(420px,80vw)] text-ink" />
          <div className="mt-16">
            <DemoExperience compact />
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
