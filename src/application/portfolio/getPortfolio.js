import { normalizePortfolioContent } from '../../domain/portfolio/normalizePortfolioContent.js'
import { portfolioSource } from '../../infrastructure/content/portfolioSourceFactory.js'

export async function getPortfolio(source = portfolioSource) {
  return normalizePortfolioContent(await source.load())
}
