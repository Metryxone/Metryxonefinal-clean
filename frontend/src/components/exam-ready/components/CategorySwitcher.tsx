import type { DomainInfo } from '../types';

interface CategorySwitcherProps {
    domains: DomainInfo[];
    selectedDomain: string | null;
    selectedSubdomain: string | null;
    onDomainChange: (domainCode: string | null) => void;
    onSubdomainChange: (subdomainCode: string | null) => void;
    isDarkMode?: boolean;
    /** Show "All" option to see questions from all domains */
    showAllOption?: boolean;
}

/**
 * CategorySwitcher: Tab/pill navigation for domain → subdomain hierarchy.
 * All data comes from the API config — zero hardcoded values.
 *
 * Usage:
 *   <CategorySwitcher
 *     domains={config.domains}
 *     selectedDomain={domain}
 *     selectedSubdomain={subdomain}
 *     onDomainChange={setDomain}
 *     onSubdomainChange={setSubdomain}
 *   />
 */
export function CategorySwitcher({
    domains,
    selectedDomain,
    selectedSubdomain,
    onDomainChange,
    onSubdomainChange,
    isDarkMode = false,
    showAllOption = true,
}: CategorySwitcherProps) {
    const activeDomain = domains.find((d) => d.code === selectedDomain);
    const subdomains = activeDomain?.subdomains || [];

    return (
        <div className="space-y-3" data-testid="category-switcher">
            {/* Domain tabs */}
            <div className="flex flex-wrap gap-2">
                {showAllOption && (
                    <button
                        onClick={() => {
                            onDomainChange(null);
                            onSubdomainChange(null);
                        }}
                        className={`
              px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
              ${!selectedDomain
                                ? isDarkMode
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                                    : 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                                : isDarkMode
                                    ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }
            `}
                        data-testid="domain-all"
                    >
                        All Domains
                    </button>
                )}

                {domains.map((domain) => (
                    <button
                        key={domain.code}
                        onClick={() => {
                            onDomainChange(domain.code);
                            onSubdomainChange(null); // reset subdomain when switching domain
                        }}
                        className={`
              px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
              ${selectedDomain === domain.code
                                ? isDarkMode
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                                    : 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                                : isDarkMode
                                    ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }
            `}
                        title={domain.name}
                        data-testid={`domain-${domain.code}`}
                    >
                        {domain.code}
                        <span className="ml-1 text-xs opacity-70">
                            ({domain.subdomains.length})
                        </span>
                    </button>
                ))}
            </div>

            {/* Subdomain pills (only shown when a domain is selected) */}
            {activeDomain && subdomains.length > 0 && (
                <div className="flex flex-wrap gap-2 pl-2">
                    <button
                        onClick={() => onSubdomainChange(null)}
                        className={`
              px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200
              ${!selectedSubdomain
                                ? isDarkMode
                                    ? 'bg-[rgba(11,60,93,0.08)] text-white'
                                    : 'bg-[rgba(11,60,93,0.08)] text-white'
                                : isDarkMode
                                    ? 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                                    : 'bg-gray-50 text-gray-500 hover:bg-gray-100 border border-gray-200'
                            }
            `}
                        data-testid="subdomain-all"
                    >
                        All {activeDomain.code}
                    </button>

                    {subdomains.map((sub) => (
                        <button
                            key={sub.code}
                            onClick={() => onSubdomainChange(sub.code)}
                            className={`
                px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200
                ${selectedSubdomain === sub.code
                                    ? isDarkMode
                                        ? 'bg-[rgba(11,60,93,0.08)] text-white'
                                        : 'bg-[rgba(11,60,93,0.08)] text-white'
                                    : isDarkMode
                                        ? 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                                        : 'bg-gray-50 text-gray-500 hover:bg-gray-100 border border-gray-200'
                                }
              `}
                            title={sub.name}
                            data-testid={`subdomain-${sub.code}`}
                        >
                            {sub.name}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
