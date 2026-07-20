# frozen_string_literal: true

require "minitest/autorun"
require_relative "../lib/build_number"

class BuildNumberTest < Minitest::Test
  def test_first_build_in_a_train_is_one
    assert_equal 1, NeoGym::BuildNumber.select(latest: nil)
    assert_equal 1, NeoGym::BuildNumber.select(latest: 0)
  end

  def test_automatic_build_is_one_greater_than_latest
    assert_equal 42, NeoGym::BuildNumber.select(latest: 41)
  end

  def test_accepts_a_newer_positive_override
    assert_equal 47, NeoGym::BuildNumber.select(latest: 41, override: "47")
  end

  def test_rejects_used_or_non_monotonic_overrides
    ["40", "41"].each do |override|
      assert_raises(NeoGym::BuildNumber::Invalid) do
        NeoGym::BuildNumber.select(latest: 41, override: override)
      end
    end
  end

  def test_rejects_zero_negative_malformed_trailing_and_ambiguous_inputs
    ["0", "-1", "+2", "1.0", "2x", "2 ", " 2", "02", "", Object.new].each do |override|
      assert_raises(NeoGym::BuildNumber::Invalid) do
        NeoGym::BuildNumber.select(latest: 1, override: override)
      end
    end
  end

  def test_rejects_overflow_and_increment_overflow
    assert_raises(NeoGym::BuildNumber::Invalid) do
      NeoGym::BuildNumber.select(latest: 1, override: "2147483648")
    end
    assert_raises(NeoGym::BuildNumber::Invalid) do
      NeoGym::BuildNumber.select(latest: NeoGym::BuildNumber::MAXIMUM)
    end
  end

  def test_race_check_accepts_only_a_number_still_above_latest
    assert_equal 42,
      NeoGym::BuildNumber.assert_still_available!(selected: 42, latest: 41)
    assert_raises(NeoGym::BuildNumber::Invalid) do
      NeoGym::BuildNumber.assert_still_available!(selected: 42, latest: 42)
    end
    assert_raises(NeoGym::BuildNumber::Invalid) do
      NeoGym::BuildNumber.assert_still_available!(selected: 42, latest: 43)
    end
  end
end
