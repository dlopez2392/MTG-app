import TopBar from "@/components/layout/TopBar";
import PageContainer from "@/components/layout/PageContainer";
import BracketCalculator from "@/components/brackets/BracketCalculator";

export default function BracketsPage() {
  return (
    <>
      <TopBar title="Commander Brackets" showBack />
      <PageContainer>
        <BracketCalculator />
      </PageContainer>
    </>
  );
}
