import { Users } from "lucide-react";

const SocialProof = () => (
  <section className="py-14 bg-white border-y border-gray-100">
    <div className="container mx-auto px-4">
      <div className="flex flex-col items-center text-center gap-2">
        <div className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center mb-1">
          <Users size={18} className="text-gray-400" />
        </div>
        <h3 className="font-display text-lg font-bold text-gray-900">Trusted by Developers</h3>
        <span className="text-xs font-medium text-gray-400 bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-full">
          Coming Soon
        </span>
        <p className="text-sm text-gray-500 max-w-sm mt-1">
          We're just getting started — real stories from real builders will show up here.
        </p>
      </div>
    </div>
  </section>
);

export default SocialProof;
