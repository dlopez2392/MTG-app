import TopBar from "@/components/layout/TopBar";
import PageContainer from "@/components/layout/PageContainer";
import CardAllocationClient from "@/components/allocation/CardAllocationClient";

export default function AllocationPage() {
  return (
    <>
      <TopBar title="Card Allocation" showBack />
      <PageContainer>
        <CardAllocationClient />
      </PageContainer>
    </>
  );
}
