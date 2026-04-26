import { test, expect } from "@playwright/test";

test("login page renders correctly", async ({ page }) => {
  await page.goto("http://localhost:3000/login");
  await expect(page.getByRole("heading", { name: "QDII 套利监控" })).toBeVisible();
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await expect(page.locator('input[type="password"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "登录" })).toBeVisible();
});

test("homepage shows fund overview", async ({ page }) => {
  await page.goto("http://localhost:3000");
  await expect(page.locator("text=QDII 基金套利监控")).toBeVisible();
  await expect(page.locator("text=登录查看完整数据")).toBeVisible();
});

test("unauthenticated redirect to login", async ({ page }) => {
  await page.goto("http://localhost:3000/funds");
  await page.waitForURL("**/login");
});
