import { FundDetail } from "@/components/funds/FundDetail";

type Props = {
  params: Promise<{ symbol: string }>;
};

export default async function FundPage({ params }: Props) {
  const { symbol } = await params;
  return <FundDetail symbol={symbol} />;
}
