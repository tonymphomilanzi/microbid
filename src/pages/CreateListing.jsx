import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import PageContainer from "../components/layout/PageContainer";
import CreateListingForm from "../components/forms/CreateListingForm";
import { listingsService } from "../services/listings.service";

export default function CreateListing() {
  const [sp] = useSearchParams();
  const editId = sp.get("edit");

  const [initial, setInitial] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function run() {
      if (!editId) {
        setInitial(null);
        return;
      }
      const { listing } = await listingsService.getListing(editId);
      if (mounted) setInitial(listing);
    }

    run();
    return () => (mounted = false);
  }, [editId]);

  return (
    <PageContainer>
      <div className="py-8">
        <CreateListingForm initial={initial ?? undefined} />
      </div>
    </PageContainer>
  );
}